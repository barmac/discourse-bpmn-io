import { withPluginApi } from 'discourse/lib/plugin-api';
import Mobile from 'discourse/lib/mobile';

const ERROR_MESSAGE = 'Failed to display the preview. See console for details.';

export default {
  name: 'bpmn-io-previews',
  initialize() {
    withPluginApi('0.8.41', api => {

      // disable for mobile
      if (Mobile.mobileView) return;

      try {
        api.decorateCookedElement(
          post => {
            const diagramLinks = post.querySelectorAll(
              '.attachment[href$=".bpmn"], .attachment[href$=".dmn"]');

            for (const diagramLink of diagramLinks) {
              const preview = createPreviewElement(diagramLink.textContent, diagramLink.href);

              diagramLink.parentElement.appendChild(preview);
            }
          },
          {
            id: 'bpmn-io-previews',
            onlyStream: true
          }
        );
      } catch (error) {
        console.error('There\'s an issue in the bpmn.io preview component.', error);
      }
    });
  }
};


function createPreviewElement(filename, diagramLink) {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = `Preview ${filename}`
  details.appendChild(summary);

  details.addEventListener('toggle', async () => {
    const previewContainer = createPreviewContainer(filename);

    try {
      await appendAndLoad(details, previewContainer);

      const response = await fetch(diagramLink);

      if (!response.ok) {
        throw new Error(`Error when fetching diagram: ${res.status}`);
      }

      const text = await response.text();

      postMessage({ type: 'openDiagram', content: text });
    } catch (error) {
      postMessage({ type: 'error' });
      console.error('Failed to display the preview', error);
    }

    function postMessage(data) {
      previewContainer.contentWindow.postMessage(data, '*');
    }
  }, { once: true });

  return details;
};

function createPreviewContainer(filename) {
  const preview = document.createElement('iframe');
  preview.loading = 'lazy';
  preview.classList.add('bpmn-io-preview');
  preview.sandbox = 'allow-scripts allow-popups';
  preview.allow = 'fullscreen';
  preview.srcdoc = createPreviewTemplate(filename);

  return preview;
}

function createPreviewTemplate(filename) {

  const type = getDiagramType(filename);

  return `
<!doctype html>
<html lang="en">
  <head>
    <style>
      html, body, #container {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        background-color: white;
      }
      .fullscreen-toggle {
        position: absolute;
        top: 10px;
        right: 10px;
      }
    </style>
    ${loadViewer(type)}
    <script defer>
    window.addEventListener('message', event => {
      const container = document.getElementById('container'),
            messageType = event.data.type;

      if (messageType === 'error') {
        container.textContent = '${ERROR_MESSAGE}'
        return;
      } else if (messageType !== 'openDiagram') {
        return;
      }

      const diagramXML = event.data.content;
      ${loadDiagram(type)}
    }, { once: true });
    </script>
  </head>
  <body>
    <div id="container"></div>
    <script>${loadFullscreenHandler()}</script>
  </body>
</html>`;
}

function getDiagramType(filename) {
  if (filename.endsWith('.bpmn')) {
    return 'bpmn';
  } else if (filename.endsWith('.dmn')) {
    return 'dmn';
  }
}

function loadViewer(type) {
  if (type === 'bpmn') {
    return '<script src="https://unpkg.com/bpmn-js@8.7.1/dist/bpmn-navigated-viewer.production.min.js"></script>';
  } else if (type === 'dmn') {
    return `
<link rel="stylesheet" href="https://unpkg.com/dmn-js@11.0.1/dist/assets/dmn-js-drd.css">
<link rel="stylesheet" href="https://unpkg.com/dmn-js@11.0.1/dist/assets/dmn-js-decision-table.css">
<link rel="stylesheet" href="https://unpkg.com/dmn-js@11.0.1/dist/assets/dmn-js-literal-expression.css">
<link rel="stylesheet" href="https://unpkg.com/dmn-js@11.0.1/dist/assets/dmn-js-shared.css">
<link rel="stylesheet" href="https://unpkg.com/dmn-js@11.0.1/dist/assets/dmn-font/css/dmn.css">
<script defer src="https://unpkg.com/dmn-js@11.0.1/dist/dmn-navigated-viewer.production.min.js"></script>`;
  }
}

function loadDiagram(type) {
  if (type === 'bpmn') {
    return loadBpmn();
  } else if (type === 'dmn') {
    return loadDmn();
  }
}

function loadBpmn() {
  return `
const viewer = new BpmnJS({
  container
});

viewer.importXML(diagramXML)
  .then(() => {
    viewer.get('canvas').zoom('fit-viewport');
  })
  .catch(error => {
    console.error('Unable to display preview:', error);
    container.textContent = '${ERROR_MESSAGE}'
  });`;
}

function loadDmn() {
  return `
const viewer = new DmnJS({
  container
});

viewer.importXML(diagramXML)
  .then(() => {
    viewer.getActiveViewer()
      .get('canvas')
      .zoom('fit-viewport');
  })
  .catch(error => {
    console.error('Unable to display preview:', error);
    container.textContent = '${ERROR_MESSAGE}'
  });`;
}

function appendAndLoad(parent, child) {
  return new Promise(resolve => {
    parent.appendChild(child);
    child.onload = resolve;
  });
}


function loadFullscreenHandler() {

  function load() {

    // do nothing if fullscreen is disabled
    if (
      !document.fullscreenEnabled &&
      !document.webkitFullscreenEnabled &&
      !document.mozFullScreenEnabled &&
      !document.msFullscreenEnabled
    ) {
      return;
    }

    const container = document.getElementById('container');

    const button = document.createElement('button');
    button.textContent = 'Toggle fullscreen';
    button.classList.add('fullscreen-toggle');

    button.onclick = () => {
      if (!document.fullscreenElement &&
          !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          container.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          container.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    };

    document.body.appendChild(button);
  }

  return `(${load.toString()})()`;
}
