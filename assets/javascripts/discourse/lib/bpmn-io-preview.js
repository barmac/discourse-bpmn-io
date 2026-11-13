import getURL from "discourse/lib/get-url";
import { i18n } from "discourse-i18n";
import VIEWER_URLS from "discourse/plugins/discourse-bpmn-io/discourse/lib/bpmn-io-viewer-urls";

const DIAGRAM_LINKS =
  'a.attachment[href$=".bpmn" i], a.attachment[href$=".dmn" i]';

/**
 * Adds a collapsed preview below every BPMN / DMN attachment link in a post.
 *
 * @param {HTMLElement} element - the cooked post element
 */
export function decorateDiagramAttachments(element) {
  for (const link of element.querySelectorAll(DIAGRAM_LINKS)) {
    const type = getDiagramType(link);

    if (!type || link.dataset.bpmnIoPreview) {
      continue;
    }

    link.dataset.bpmnIoPreview = type;
    link.parentElement.append(createPreview(link, type));
  }
}

function getDiagramType(link) {
  const path = new URL(link.href, window.location.href).pathname.toLowerCase();

  if (path.endsWith(".bpmn")) {
    return "bpmn";
  }

  if (path.endsWith(".dmn")) {
    return "dmn";
  }
}

function createPreview(link, type) {
  const title = i18n("discourse_bpmn_io.preview", {
    filename: link.textContent.trim(),
  });

  const details = document.createElement("details");
  details.classList.add("bpmn-io-preview");

  const summary = document.createElement("summary");
  summary.textContent = title;
  details.append(summary);

  details.addEventListener("toggle", () => {
    if (details.open && !details.querySelector("iframe")) {
      details.append(createViewerFrame(link.href, type, title));
    }
  });

  return details;
}

// The diagram is rendered in a sandboxed iframe that loads a static page
// shipped in the plugin's public/ directory (see scripts/build-viewer.mjs).
// Unlike a `srcdoc` iframe, that page does not inherit Discourse's Content
// Security Policy, and without `allow-same-origin` it runs in an opaque origin
// that cannot reach the forum on behalf of the user.
function createViewerFrame(url, type, title) {
  const iframe = document.createElement("iframe");
  iframe.classList.add("bpmn-io-preview__frame");
  iframe.title = title;
  iframe.setAttribute("sandbox", "allow-scripts allow-popups");
  iframe.setAttribute("allow", "fullscreen");

  // start downloading while the viewer page loads
  const diagram = fetchDiagram(url);
  const labels = {
    error: i18n("discourse_bpmn_io.error"),
    toggleFullscreen: i18n("discourse_bpmn_io.toggle_fullscreen"),
    zoomIn: i18n("discourse_bpmn_io.zoom_in"),
    zoomOut: i18n("discourse_bpmn_io.zoom_out"),
    zoom: i18n("discourse_bpmn_io.zoom_level"),
    fitDiagram: i18n("discourse_bpmn_io.fit_diagram"),
    openMinimap: i18n("discourse_bpmn_io.open_minimap"),
    closeMinimap: i18n("discourse_bpmn_io.close_minimap"),
  };

  // fires after the viewer's scripts ran, and again if the frame reloads
  iframe.addEventListener("load", async () => {
    let message;

    try {
      message = { type: "bpmn-io:open", xml: await diagram, labels };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[discourse-bpmn-io] Failed to fetch the diagram", error);
      message = { type: "bpmn-io:error", labels };
    }

    // an opaque origin cannot be targeted by name
    iframe.contentWindow?.postMessage(message, "*");
  });

  iframe.src = getURL(VIEWER_URLS[type]);

  return iframe;
}

async function fetchDiagram(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unexpected response status: ${response.status}`);
  }

  return response.text();
}
