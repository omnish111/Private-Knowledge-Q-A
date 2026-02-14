const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { OpenAI } = require("openai");

let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log("OpenAI API initialized successfully");
} catch (err) {
  console.error("Warning: OpenAI API not initialized:", err.message);
}

const app = express();
const PORT = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Root route removed to allow Vercel to serve index.html
// If this is hit, it means Vercel routed '/' to the server, which is incorrect for SPA
// app.get("/", (req, res) => {
//   res.json({ status: "API Server is running", timestamp: new Date() });
// });

// Upload directory setup
// Note: In Vercel/Serverless, the filesystem is read-only except for /tmp
const uploadDir = process.env.VERCEL 
  ? path.join('/tmp', 'uploads') 
  : path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.error("Error creating upload directory:", err);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({ storage });

// Store documents with their content
// WARNING: In Vercel serverless functions, global variables are not persistent across invocations.
// Accessing this array in subsequent requests might return empty.
// For production, use a database (MongoDB, PostgreSQL, etc.) and blob storage (S3, Vercel Blob).
const uploadedDocuments = [];

// Routes

// Get all uploaded documents
app.get("/api/documents", (req, res) => {
  res.json(uploadedDocuments);
});

// Delete a document
app.delete("/api/documents/:id", (req, res) => {
  const docId = parseInt(req.params.id);
  const docIndex = uploadedDocuments.findIndex((doc) => doc.id === docId);

  if (docIndex === -1) {
    return res.status(404).json({ error: "Document not found" });
  }

  const deletedDoc = uploadedDocuments.splice(docIndex, 1)[0];

  // Delete file from disk
  try {
    if (fs.existsSync(deletedDoc.path)) {
      fs.unlinkSync(deletedDoc.path);
    }
  } catch (err) {
    console.error("Error deleting file from disk:", err);
  }

  res.json({ message: "Document deleted successfully" });
});

// Upload a document
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Read file content
  const fileContent = fs.readFileSync(req.file.path, "utf-8");

  const doc = {
    id: uploadedDocuments.length + 1,
    name: req.file.originalname,
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    content: fileContent,
    uploadedAt: new Date(),
  };

  uploadedDocuments.push(doc);
  res.json({ message: "File uploaded successfully", document: doc });
});

// Helper function: Get answer using keyword search (fallback method)
function getAnswerFromDocuments(question, documents) {
  const questionLower = question.toLowerCase();
  const questionWords = questionLower.split(/\s+/).filter((w) => w.length > 2);
  let allMatches = [];

  for (const doc of documents) {
    const sentences = doc.content
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      let score = 0;
      let matchCount = 0;

      // Score based on keyword matches
      for (const word of questionWords) {
        if (sentenceLower.includes(word)) {
          score += 3;
          matchCount++;
        }
      }

      // Bonus for consecutive words from question
      const questionPhrase = questionLower.substring(
        0,
        Math.min(15, questionLower.length),
      );
      if (sentenceLower.includes(questionPhrase)) {
        score += 10;
      }

      // Bonus based on how many keywords matched
      if (matchCount > 0) {
        score += matchCount * 2;
      }

      if (score > 0) {
        allMatches.push({
          document: doc.name,
          excerpt: sentence.trim().substring(0, 300),
          score: score,
          matchCount: matchCount,
        });
      }
    }
  }

  // Sort by score and match count
  allMatches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.matchCount - a.matchCount;
  });

  let answer =
    "I couldn't find specific information about your question in the uploaded documents.";
  const sources = [];

  if (allMatches.length > 0) {
    // Use the best matching sentence as answer
    answer = allMatches[0].excerpt;

    // Add top 3 sources
    for (let i = 0; i < Math.min(3, allMatches.length); i++) {
      sources.push({
        document: allMatches[i].document,
        excerpt: allMatches[i].excerpt,
      });
    }
  }

  return {
    answer,
    sources,
    primaryDocument: allMatches.length > 0 ? allMatches[0].document : null,
  };
}

// Get answer based on question and documents
app.post("/api/ask", async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  if (uploadedDocuments.length === 0) {
    return res.status(400).json({ error: "No documents uploaded" });
  }

  try {
    if (!openai) {
      return res.status(500).json({
        error: "OpenAI API not initialized. Please check your API key.",
      });
    }

    // Create a context for each document with clear markers
    let documentContent = "";
    const documentMap = {}; // Map to track which lines come from which document

    for (const doc of uploadedDocuments) {
      documentContent += `\n========== Document: ${doc.name} ==========\n`;
      documentContent += doc.content + "\n";
      documentMap[doc.name] = doc.id;
    }

    console.log("Processing question:", question);
    console.log("Number of documents:", uploadedDocuments.length);
    console.log("Document content length:", documentContent.length);

    // Create an enhanced prompt that encourages citing sources
    const systemPrompt = `You are a document-focused assistant. Your job is to answer questions ONLY based on the provided documents.

CRITICAL RULES:
1. ONLY use information directly from the documents below
2. Do NOT use any external knowledge or training data
3. Always cite the specific document name that contains your answer
4. If information is not in ANY document, say: "This information is not available in the provided documents."
5. Quote directly from the documents when possible
6. Format your answer as: "According to [DOCUMENT NAME]: [your answer]"
7. Be precise and factual - quote exact text when relevant

DOCUMENTS:
${documentContent}

Remember: Use ONLY the document content to answer. No external knowledge. Always include document name in your answer.`;

    console.log("Calling OpenAI API...");
    console.log("API Key exists:", !!process.env.OPENAI_API_KEY);

    const message = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: question,
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    console.log("OpenAI response received");
    const answer = message.choices[0].message.content;
    console.log("Answer generated:", answer.substring(0, 100));

    // Extract sources by analyzing answer and finding relevant excerpts
    const sources = [];
    const sourceSet = new Map();
    const questionLower = question.toLowerCase();
    const questionWords = questionLower.split(" ").filter((w) => w.length > 3);

    // First, check if document names are explicitly mentioned in the answer
    for (const doc of uploadedDocuments) {
      const docNameLower = doc.name.toLowerCase();
      const docNameWithoutExt = doc.name.split(".")[0].toLowerCase();

      if (
        answer.toLowerCase().includes(docNameLower) ||
        answer.toLowerCase().includes(docNameWithoutExt)
      ) {
        sourceSet.set(doc.name, {
          docName: doc.name,
          doc: doc,
          mentioned: true,
        });
      }
    }

    // If no documents mentioned, find them using keyword matching
    if (sourceSet.size === 0) {
      const documentScores = {};

      for (const doc of uploadedDocuments) {
        let score = 0;
        const contentLower = doc.content.toLowerCase();

        // Count keyword matches
        for (const word of questionWords) {
          const regex = new RegExp(`\\b${word}\\b`, "g");
          const matches = (contentLower.match(regex) || []).length;
          score += matches * 2;
        }

        if (score > 0) {
          documentScores[doc.name] = { score, doc };
        }
      }

      // Get top documents
      const sortedDocs = Object.entries(documentScores)
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 3);

      sortedDocs.forEach(([docName, { doc }]) => {
        sourceSet.set(docName, { docName, doc, mentioned: false });
      });
    }

    // Extract relevant sentences from source documents
    for (const [docName, { doc }] of sourceSet) {
      const sentences = doc.content
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);

      // Find sentences that match question keywords
      const relevantSentences = sentences
        .filter((sentence) =>
          questionWords.some((word) =>
            sentence.toLowerCase().includes(word.toLowerCase()),
          ),
        )
        .sort((a, b) => {
          // Sort by how many question words they contain
          const aMatches = questionWords.filter((w) =>
            a.toLowerCase().includes(w.toLowerCase()),
          ).length;
          const bMatches = questionWords.filter((w) =>
            b.toLowerCase().includes(w.toLowerCase()),
          ).length;
          return bMatches - aMatches;
        });

      if (relevantSentences.length > 0) {
        sources.push({
          document: docName,
          excerpt: relevantSentences[0].trim().substring(0, 250),
        });
      }
    }

    console.log("Answer extracted successfully");
    console.log("Number of sources found:", sources.length);

    res.json({
      question,
      answer,
      sources: sources.slice(0, 3),
      confidence: 0.95,
      method: "openai",
    });
  } catch (error) {
    console.error("OpenAI API Error Type:", error.constructor.name);
    console.error("OpenAI API Error Status:", error.status);
    console.error("OpenAI API Error Message:", error.message);
    console.error("Full error:", error);

    // Use fallback method if OpenAI fails
    console.log("Using fallback search method...");
    const fallbackResult = getAnswerFromDocuments(question, uploadedDocuments);

    console.log("Fallback answer generated successfully");
    console.log("Fallback sources:", fallbackResult.sources.length);

    return res.json({
      question,
      answer: fallbackResult.answer,
      sources: fallbackResult.sources,
      confidence: 0.7,
      method: "fallback_search",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
