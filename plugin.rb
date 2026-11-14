# frozen_string_literal: true

# name: discourse-bpmn-io
# about: Display BPMN and DMN diagrams below uploaded files.
# version: 0.2.0
# authors: Maciej Barelkowski <maciej.barelkowski@camunda.com>
# url: https://github.com/barmac/discourse-bpmn-io
# required_version: 3.4.0

enabled_site_setting :discourse_bpmn_io_enabled

register_asset "stylesheets/bpmn-io-preview.scss"
