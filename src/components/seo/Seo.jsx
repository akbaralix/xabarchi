import { useEffect } from "react";

const SITE_NAME = "Xabarchi";
const DEFAULT_DESCRIPTION =
  "Xabarchi ijtimoiy tarmog'i: postlar, profillar va xabarlar bir joyda.";
const DEFAULT_IMAGE_PATH = "/xabarchi-logo.png";

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const upsertLink = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const upsertStructuredData = (payload) => {
  const id = "seo-structured-data";
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
};

function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE_PATH,
  noindex = false,
}) {
  useEffect(() => {
    const origin = window.location.origin;
    const href = window.location.href;
    const imageUrl = image.startsWith("http") ? image : `${origin}${image}`;
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const robots = noindex ? "noindex, nofollow" : "index, follow";

    document.title = fullTitle;
    upsertMeta('meta[name="description"]', {
      name: "description",
      content: description,
    });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: robots,
    });
    upsertMeta('meta[property="og:type"]', {
      property: "og:type",
      content: "website",
    });
    upsertMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: SITE_NAME,
    });
    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: fullTitle,
    });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: description,
    });
    upsertMeta('meta[property="og:url"]', {
      property: "og:url",
      content: href,
    });
    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: imageUrl,
    });
    upsertMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });
    upsertMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: fullTitle,
    });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: description,
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: imageUrl,
    });
    upsertLink('link[rel="canonical"]', {
      rel: "canonical",
      href,
    });

    upsertStructuredData({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: origin,
      potentialAction: {
        "@type": "SearchAction",
        target: `${origin}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    });
  }, [description, image, noindex, title]);

  return null;
}

export default Seo;
