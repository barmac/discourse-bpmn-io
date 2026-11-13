# frozen_string_literal: true

RSpec.describe "Diagram previews" do
  fab!(:current_user, :user)

  before do
    enable_current_plugin
    # the previews used to be blocked by Discourse's Content Security Policy
    SiteSetting.content_security_policy = true
    SiteSetting.authorized_extensions = "bpmn|dmn"
    sign_in(current_user)
  end

  def post_with_attachment(fixture, filename)
    upload =
      File.open(File.expand_path("../fixtures/#{fixture}", __dir__)) do |file|
        UploadCreator.new(file, filename).create_for(current_user.id)
      end

    Fabricate(:post, user: current_user, raw: "[#{filename}|attachment](#{upload.short_url})")
  end

  def open_preview(filename)
    find("details.bpmn-io-preview summary", text: filename).click
    find("details.bpmn-io-preview[open] iframe")
  end

  it "renders an attached BPMN diagram" do
    post = post_with_attachment("diagram.bpmn", "order.bpmn")
    visit(post.topic.relative_url)

    within_frame(open_preview("order.bpmn")) do
      expect(page).to have_css(".djs-element[data-element-id='Task_1']")
    end
  end

  it "renders an attached DMN diagram" do
    post = post_with_attachment("diagram.dmn", "carrier.dmn")
    visit(post.topic.relative_url)

    within_frame(open_preview("carrier.dmn")) do
      expect(page).to have_css(".djs-element[data-element-id='Decision_1']")
    end
  end

  it "offers navigation controls and a minimap" do
    post = post_with_attachment("diagram.bpmn", "order.bpmn")
    visit(post.topic.relative_url)

    within_frame(open_preview("order.bpmn")) do
      # the small fixture fits at 100%
      expect(page).to have_css("input.zoom-slider[aria-valuetext='100%']")

      find("button.zoom-in[title='Zoom in']").click
      expect(page).to have_css("input.zoom-slider[aria-valuetext='125%']")

      find("button.fit[title='Fit diagram to view']").click
      expect(page).to have_css("input.zoom-slider[aria-valuetext='100%']")

      find(".djs-minimap .toggle[title='Open minimap']").click
      expect(page).to have_css(".djs-minimap.open")
    end
  end

  it "shows no previews when the plugin is disabled" do
    SiteSetting.discourse_bpmn_io_enabled = false
    post = post_with_attachment("diagram.bpmn", "order.bpmn")
    visit(post.topic.relative_url)

    expect(page).to have_css(".cooked a.attachment", text: "order.bpmn")
    expect(page).to have_no_css("details.bpmn-io-preview")
  end
end
