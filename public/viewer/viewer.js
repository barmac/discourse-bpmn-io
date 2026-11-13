/* global BpmnJS, DmnJS */

// Renders a diagram inside the sandboxed preview iframe.
//
// The page has an opaque origin (sandbox without allow-same-origin), so it can
// neither read the forum's cookies nor touch the embedding page. The embedding
// post sends the diagram XML and the translated labels via postMessage.

(function () {
  const DIAGRAM_TYPE = document.documentElement.dataset.diagramType;
  const DEFAULT_LABELS = {
    error:
      "Failed to display the preview. See the browser console for details.",
    toggleFullscreen: "Toggle fullscreen",
  };

  const container = document.getElementById("container");
  const errorElement = document.getElementById("error");

  let viewer;

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !event.data) {
      return;
    }

    const { type, xml } = event.data;
    const labels = { ...DEFAULT_LABELS, ...event.data.labels };

    if (type === "bpmn-io:open") {
      open(xml, labels);
    } else if (type === "bpmn-io:error") {
      showError(labels.error);
    }
  });

  window.addEventListener("resize", () => getCanvas()?.resized());
  document.addEventListener("fullscreenchange", fitLater);
  document.addEventListener("webkitfullscreenchange", fitLater);

  async function open(xml, labels) {
    addFullscreenToggle(labels.toggleFullscreen);

    try {
      viewer ||= createViewer();

      const { warnings } = await viewer.importXML(xml);

      if (warnings.length) {
        // eslint-disable-next-line no-console
        console.warn("Diagram imported with warnings", warnings);
      }

      errorElement.hidden = true;
      container.hidden = false;
      fit();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Unable to display the diagram", error);
      showError(labels.error);
    }
  }

  function createViewer() {
    if (DIAGRAM_TYPE === "bpmn") {
      return new BpmnJS({ container });
    }

    if (DIAGRAM_TYPE === "dmn") {
      return new DmnJS({ container });
    }

    throw new Error(`Unsupported diagram type: ${DIAGRAM_TYPE}`);
  }

  // DMN files can open in a decision table or literal expression view,
  // which have no canvas to zoom.
  function getCanvas() {
    if (!viewer) {
      return null;
    }

    if (DIAGRAM_TYPE === "bpmn") {
      return viewer.get("canvas");
    }

    return viewer.getActiveView()?.type === "drd"
      ? viewer.getActiveViewer().get("canvas")
      : null;
  }

  function fit() {
    const canvas = getCanvas();

    if (canvas) {
      canvas.resized();
      canvas.zoom("fit-viewport", "auto");
    }
  }

  function fitLater() {
    requestAnimationFrame(fit);
  }

  function showError(message) {
    container.hidden = true;
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  function addFullscreenToggle(label) {
    const root = document.documentElement;
    const requestFullscreen =
      root.requestFullscreen || root.webkitRequestFullscreen;
    const exitFullscreen =
      document.exitFullscreen || document.webkitExitFullscreen;
    const enabled =
      document.fullscreenEnabled || document.webkitFullscreenEnabled;

    if (!enabled || !requestFullscreen || document.querySelector(".toggle")) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "toggle";
    button.textContent = label;
    button.addEventListener("click", () => {
      const isFullscreen =
        document.fullscreenElement || document.webkitFullscreenElement;

      // the whole page goes fullscreen so that this button stays visible
      Promise.resolve(
        isFullscreen
          ? exitFullscreen.call(document)
          : requestFullscreen.call(root)
      ).catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("Unable to toggle fullscreen", error);
      });
    });

    document.body.append(button);
  }
})();
