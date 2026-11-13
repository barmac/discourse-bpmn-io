# Changelog

All notable changes to discourse-bpmn-io are documented here. We use [semantic versioning](http://semver.org/) for releases.

## Unreleased

___Note:__ Yet to be released changes appear here._

* `FIX`: make previews work with Discourse's Content Security Policy ([#4](https://github.com/barmac/discourse-bpmn-io/issues/4))
* `FIX`: keep the fullscreen toggle visible and fit the diagram in fullscreen
* `FIX`: hide previews in the mobile view on current Discourse versions again
* `FEAT`: add zoom buttons, a zoom slider and a fit-to-view button ([#1](https://github.com/barmac/discourse-bpmn-io/issues/1))
* `FEAT`: add a minimap ([#2](https://github.com/barmac/discourse-bpmn-io/issues/2))
* `FEAT`: add the `discourse_bpmn_io_enabled` site setting
* `FEAT`: make preview labels translatable
* `CHORE`: ship bpmn-js@18.31.1, dmn-js@18.0.3 and diagram-js-minimap@5.6.0 with the plugin instead of loading them from unpkg.com
* `CHORE`: adopt the Discourse plugin skeleton (linting, CI, system specs) ([#3](https://github.com/barmac/discourse-bpmn-io/issues/3))
* `CHORE`: require Discourse 3.4.0 or later

## 0.1.0

* `FEAT`: initial release :tada:
