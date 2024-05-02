const express = require("express");
const { ComfyUIClient } = require("comfy-ui-client");
const { writeFile, mkdir } = require("fs/promises");
const { join } = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = 3000;
const comfyUIUrl = "comfy.sizingservers.be";
const clientId = "pano360";
const client = new ComfyUIClient(comfyUIUrl, clientId, { secure: true });
const workflowFile = require("./workflow_api.json");
const outputDir = "output";

// Middleware
app.use(cors());
app.use(bodyParser.json());

const debug = false;
const debugPath = "output/240430082729_360_00006_.png";

// POST route to process image generation
app.post("/generate-image", async (req, res) => {
  console.log("Request received");
  try {
    const {
      promptText,
      negativePromptText = "nsfw, text, watermark, cartoon, fake, not-realistic",
    } = req.body;
    if (!promptText) {
      return res.status(400).send({ error: "Prompt text is required" });
    }

    if (debug) {
      res.sendFile(debugPath, { root: "." });
      return;
    } else {
      // Setup workflow configuration
      const apiJSON = workflowFile;
      const positivePromptNodeKey = "16";
      const negativePromptNodeKey = "16";
      const outputImageNodeKey = "70";
      const seedNodes = ["16", "21", "58", "68"];
      apiJSON[positivePromptNodeKey]["inputs"]["positive_prompt"] = promptText;
      apiJSON[negativePromptNodeKey]["inputs"]["negative_prompt"] =
        negativePromptText;
      for (const seedNodeKey of seedNodes) {
        apiJSON[seedNodeKey]["inputs"]["seed"] = Math.floor(
          Math.random() * 10000
        );
      }

      // Connect and process the image
      await client.connect();
      const images = await client.getImages(apiJSON);
      await mkdir(outputDir, { recursive: true });

      if (images[outputImageNodeKey]) {
        const img = images[outputImageNodeKey][0];
        const arrayBuffer = await img.blob.arrayBuffer();
        const outputPath = join(outputDir, img.image.filename);
        await writeFile(outputPath, Buffer.from(arrayBuffer));

        // Send the image file in response
        res.sendFile(outputPath, { root: "." });
      } else {
        res.status(404).send({ error: "Image not generated" });
      }

      await client.disconnect();
    }
  } catch (error) {
    console.error("Failed to generate image:", error);
    res.status(500).send({ error: "Failed to process the image" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
