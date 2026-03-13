import nacl from "tweetnacl";

const encodeUTF8 = (bytes) => new TextDecoder().decode(bytes);
const decodeUTF8 = (text) => new TextEncoder().encode(text);

const encodeBase64 = (bytes) => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const decodeBase64 = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const STORAGE_KEY = "e2e:keypair:v1";

const safeParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getStoredKeyPair = () => {
  const raw = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!raw || !raw.publicKey || !raw.secretKey) return null;
  return {
    publicKey: String(raw.publicKey),
    secretKey: String(raw.secretKey),
  };
};

export const ensureKeyPair = () => {
  const existing = getStoredKeyPair();
  if (existing) return existing;

  const keyPair = nacl.box.keyPair();
  const stored = {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
};

const decodeKey = (base64) => {
  try {
    return decodeBase64(base64);
  } catch {
    return null;
  }
};

export const encryptText = (plainText, peerPublicKeyB64, mySecretKeyB64) => {
  const peerPublicKey = decodeKey(peerPublicKeyB64);
  const mySecretKey = decodeKey(mySecretKeyB64);
  if (!peerPublicKey || !mySecretKey) return null;

  const sharedKey = nacl.box.before(peerPublicKey, mySecretKey);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = decodeUTF8(plainText);
  const cipher = nacl.box.after(messageBytes, nonce, sharedKey);

  return {
    ciphertext: encodeBase64(cipher),
    nonce: encodeBase64(nonce),
  };
};

export const decryptText = (ciphertextB64, nonceB64, peerPublicKeyB64, mySecretKeyB64) => {
  const peerPublicKey = decodeKey(peerPublicKeyB64);
  const mySecretKey = decodeKey(mySecretKeyB64);
  if (!peerPublicKey || !mySecretKey) return null;

  const cipher = decodeKey(ciphertextB64);
  const nonce = decodeKey(nonceB64);
  if (!cipher || !nonce) return null;

  const sharedKey = nacl.box.before(peerPublicKey, mySecretKey);
  const plainBytes = nacl.box.open.after(cipher, nonce, sharedKey);
  if (!plainBytes) return null;
  return encodeUTF8(plainBytes);
};
