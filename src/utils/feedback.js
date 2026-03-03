export const notify = (message, type = "info", duration = 3200) => {
  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: { message, type, duration },
    }),
  );
};

export const notifySuccess = (message) => notify(message, "success");
export const notifyError = (message) => notify(message, "error");
export const notifyInfo = (message) => notify(message, "info");

export const confirmAction = (message, confirmText = "Tasdiqlash", cancelText = "Bekor") =>
  new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent("app:confirm", {
        detail: { message, confirmText, cancelText, resolve },
      }),
    );
  });
