require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/slack/interactions", async (req, res) => {
  const payload = JSON.parse(req.body.payload);

  // Handle button click to open modal
  if (payload.type === "block_actions" && payload.actions[0].action_id === "change_vendor") {
    const { job, row } = JSON.parse(payload.actions[0].value);

    try {
      const vendorsRes = await axios.get(`${process.env.SCRIPT_WEB_APP_URL}?action=getVendors`);
      const vendors = vendorsRes.data;

      await axios.post("https://slack.com/api/views.open", {
        trigger_id: payload.trigger_id,
        view: {
          type: "modal",
          callback_id: "vendor_selection_modal",
          private_metadata: JSON.stringify({ row }),
          title: { type: "plain_text", text: "Change Vendor" },
          submit: { type: "plain_text", text: "Submit" },
          blocks: [
            {
              type: "input",
              block_id: "vendor_block",
              label: { type: "plain_text", text: "Select a Vendor" },
              element: {
                type: "static_select",
                action_id: "vendor_select",
                options: vendors.map(v => ({
                  text: { type: "plain_text", text: v.text },
                  value: v.value
                }))
              }
            }
          ]
        }
      }, {
        headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
      });

      res.status(200).send();
    } catch (error) {
      console.error("❌ Error opening modal:", error.message);
      res.status(500).send("Failed to open modal");
    }
  }

  // Handle modal submission
  else if (payload.type === "view_submission" && payload.view.callback_id === "vendor_selection_modal") {
    const selectedVendor = payload.view.state.values.vendor_block.vendor_select.selected_option.value;
    const row = JSON.parse(payload.view.private_metadata).row;

    try {
      await axios.post(process.env.SCRIPT_WEB_APP_URL, {
        row,
        vendor: selectedVendor
      });

      await axios.post(process.env.SLACK_WEBHOOK_URL, {
        text: `✅ Vendor changed to *${selectedVendor}* for row ${row}`
      });

      res.status(200).send();
    } catch (error) {
      console.error("❌ Error submitting modal:", error.message);
      res.status(500).send("Failed to submit modal");
    }
  } else {
    res.status(200).send();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
