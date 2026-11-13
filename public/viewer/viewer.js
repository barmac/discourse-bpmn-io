/* global BpmnJS, DmnJS, DiagramJSMinimap */

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
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    zoom: "Zoom level",
    fitDiagram: "Fit diagram to view",
    openMinimap: "Open minimap",
    closeMinimap: "Close minimap",
  };

  // strings of diagram-js extensions that are replaced with translated labels
  const TRANSLATED_STRINGS = {
    "Open minimap": "openMinimap",
    "Close minimap": "closeMinimap",
  };

  // the zoom range of diagram-js' mouse wheel zoom
  const ZOOM_RANGE = { min: 0.2, max: 4 };
  const ZOOM_STEP = 1.25;
  const SLIDER_STEPS = 100;

  const ICONS = {
    zoomOut: '<path d="M5 12h14"/>',
    zoomIn: '<path d="M12 5v14M5 12h14"/>',
    fitDiagram:
      '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="8" y="9" width="8" height="6" rx="1"/>',
    enterFullscreen: '<path d="M14 4h6v6M20 4l-6 6M10 20H4v-6M4 20l6-6"/>',
    exitFullscreen: '<path d="M4 10h6V4M10 10 4 4M20 14h-6v6M14 14l6 6"/>',
  };

  const container = document.getElementById("container");
  const errorElement = document.getElementById("error");

  let labels = DEFAULT_LABELS;
  let viewer;
  let toolbar;
  const boundDiagrams = new WeakSet();

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !event.data) {
      return;
    }

    const { type, xml } = event.data;
    labels = { ...DEFAULT_LABELS, ...event.data.labels };

    if (type === "bpmn-io:open") {
      open(xml);
    } else if (type === "bpmn-io:error") {
      showError(labels.error);
    }
  });

  window.addEventListener("resize", () => getCanvas()?.resized());
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  async function open(xml) {
    try {
      viewer ||= createViewer();

      const { warnings } = await viewer.importXML(xml);

      if (warnings.length) {
        // eslint-disable-next-line no-console
        console.warn("Diagram imported with warnings", warnings);
      }

      errorElement.hidden = true;
      container.hidden = false;
      renderToolbar();
      updateToolbar();
      fit();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Unable to display the diagram", error);
      showError(labels.error);
    }
  }

  function createViewer() {
    const diagramModules = [
      DiagramJSMinimap,
      { translate: ["value", translate] },
    ];

    if (DIAGRAM_TYPE === "bpmn") {
      return new BpmnJS({ container, additionalModules: diagramModules });
    }

    if (DIAGRAM_TYPE === "dmn") {
      const dmnViewer = new DmnJS({
        container,
        drd: { additionalModules: diagramModules },
      });

      // drilling down into a decision table leaves the diagram canvas
      dmnViewer.on("views.changed", updateToolbar);

      return dmnViewer;
    }

    throw new Error(`Unsupported diagram type: ${DIAGRAM_TYPE}`);
  }

  function translate(template, replacements = {}) {
    const key = TRANSLATED_STRINGS[template];
    const text = key ? labels[key] : template;

    return text.replace(/{([^}]+)}/g, (match, name) =>
      name in replacements ? replacements[name] : match
    );
  }

  // The diagram-js instance that draws the diagram. DMN files can also show a
  // decision table or literal expression, which have no canvas.
  function getDiagram() {
    if (!viewer) {
      return null;
    }

    if (DIAGRAM_TYPE === "bpmn") {
      return viewer;
    }

    return viewer.getActiveView()?.type === "drd"
      ? viewer.getActiveViewer()
      : null;
  }

  function getCanvas() {
    return getDiagram()?.get("canvas");
  }

  function fit() {
    const canvas = getCanvas();

    if (canvas) {
      canvas.resized();
      canvas.zoom("fit-viewport", "auto");
    }
  }

  function zoomBy(factor) {
    const canvas = getCanvas();

    if (canvas) {
      canvas.zoom(clampScale(canvas.zoom() * factor));
    }
  }

  function clampScale(scale) {
    return Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, scale));
  }

  // the slider is logarithmic, so every step changes the zoom by the same ratio
  function scaleToSlider(scale) {
    const min = Math.log(ZOOM_RANGE.min);
    const max = Math.log(ZOOM_RANGE.max);

    return Math.round(
      (SLIDER_STEPS * (Math.log(clampScale(scale)) - min)) / (max - min)
    );
  }

  function sliderToScale(value) {
    const min = Math.log(ZOOM_RANGE.min);
    const max = Math.log(ZOOM_RANGE.max);

    return Math.exp(min + (value / SLIDER_STEPS) * (max - min));
  }

  function showError(message) {
    container.hidden = true;
    errorElement.textContent = message;
    errorElement.hidden = false;

    if (toolbar) {
      toolbar.element.hidden = true;
    }
  }

  function renderToolbar() {
    if (toolbar) {
      toolbar.element.hidden = false;
      return;
    }

    const element = document.createElement("div");
    element.className = "toolbar";

    const zoomControls = document.createElement("div");
    zoomControls.className = "toolbar-group";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "zoom-slider";
    slider.min = "0";
    slider.max = String(SLIDER_STEPS);
    slider.step = "1";
    slider.title = labels.zoom;
    slider.setAttribute("aria-label", labels.zoom);
    slider.addEventListener("input", () =>
      getCanvas()?.zoom(sliderToScale(slider.valueAsNumber))
    );

    zoomControls.append(
      createButton("zoom-out", labels.zoomOut, ICONS.zoomOut, () =>
        zoomBy(1 / ZOOM_STEP)
      ),
      slider,
      createButton("zoom-in", labels.zoomIn, ICONS.zoomIn, () =>
        zoomBy(ZOOM_STEP)
      ),
      createButton("fit", labels.fitDiagram, ICONS.fitDiagram, fit)
    );
    element.append(zoomControls);

    const fullscreenButton = createFullscreenButton();
    if (fullscreenButton) {
      element.append(fullscreenButton);
    }

    document.body.append(element);
    toolbar = { element, zoomControls, slider, fullscreenButton };
  }

  function updateToolbar() {
    if (!toolbar) {
      return;
    }

    const diagram = getDiagram();

    toolbar.zoomControls.hidden = !diagram;
    document.body.classList.toggle("no-canvas", !diagram);

    if (diagram) {
      bindDiagram(diagram);
      syncSlider(diagram.get("canvas").zoom());
    }
  }

  // keep the slider in sync with mouse wheel zoom, buttons and fitting
  function bindDiagram(diagram) {
    if (boundDiagrams.has(diagram)) {
      return;
    }

    boundDiagrams.add(diagram);
    diagram
      .get("eventBus")
      .on("canvas.viewbox.changed", ({ viewbox }) => syncSlider(viewbox.scale));
  }

  function syncSlider(scale) {
    if (!toolbar) {
      return;
    }

    toolbar.slider.value = String(scaleToSlider(scale));
    toolbar.slider.setAttribute(
      "aria-valuetext",
      `${Math.round(scale * 100)}%`
    );
  }

  function createButton(name, label, icon, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = name;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = svgIcon(icon);
    button.addEventListener("click", onClick);

    return button;
  }

  function svgIcon(paths) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  }

  function isFullscreen() {
    return Boolean(
      document.fullscreenElement || document.webkitFullscreenElement
    );
  }

  function createFullscreenButton() {
    const root = document.documentElement;
    const requestFullscreen =
      root.requestFullscreen || root.webkitRequestFullscreen;
    const exitFullscreen =
      document.exitFullscreen || document.webkitExitFullscreen;
    const enabled =
      document.fullscreenEnabled || document.webkitFullscreenEnabled;

    if (!enabled || !requestFullscreen) {
      return null;
    }

    // the whole page goes fullscreen so that the toolbar stays visible
    return createButton(
      "fullscreen",
      labels.toggleFullscreen,
      ICONS.enterFullscreen,
      () => {
        Promise.resolve(
          isFullscreen()
            ? exitFullscreen.call(document)
            : requestFullscreen.call(root)
        ).catch((error) => {
          // eslint-disable-next-line no-console
          console.warn("Unable to toggle fullscreen", error);
        });
      }
    );
  }

  function onFullscreenChange() {
    if (toolbar?.fullscreenButton) {
      toolbar.fullscreenButton.innerHTML = svgIcon(
        isFullscreen() ? ICONS.exitFullscreen : ICONS.enterFullscreen
      );
    }

    requestAnimationFrame(fit);
  }
})();
