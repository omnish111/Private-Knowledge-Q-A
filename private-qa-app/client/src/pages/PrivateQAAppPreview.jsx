import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Card from "../components/Card";
import Button from "../components/Button";
import "./PrivateQAAppPreview.css";

export default function PrivateQAAppPreview() {
  const [question, setQuestion] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [file, setFile] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  // Load documents from localStorage on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = () => {
    try {
      const storedDocs = localStorage.getItem("qa_app_documents");
      if (storedDocs) {
        setUploadedDocuments(JSON.parse(storedDocs));
      }
    } catch (error) {
      console.error("Error loading documents from local storage:", error);
    }
  };

  const saveDocumentsToStorage = (docs) => {
    localStorage.setItem("qa_app_documents", JSON.stringify(docs));
  };

  const handleDeleteDocument = (e, docId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this document?")) {
      const updatedDocs = uploadedDocuments.filter((doc) => doc.id !== docId);
      setUploadedDocuments(updatedDocs);
      saveDocumentsToStorage(updatedDocs);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file");
      return;
    }

    // Basic text file validation
    if (!file.type.match('text.*') && !file.name.endsWith('.md') && !file.name.endsWith('.json')) {
        // Try to read it anyway, but warn if it might fail? 
        // For now, let's assume text-based files.
    }

    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      
      const newDoc = {
        id: Date.now().toString(),
        name: file.name,
        content: content,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      const updatedDocs = [...uploadedDocuments, newDoc];
      setUploadedDocuments(updatedDocs);
      saveDocumentsToStorage(updatedDocs);
      
      setFile(null);
      // Reset file input manually if needed, simplified here
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";
      
      setIsUploading(false);
      alert("File processed and stored locally!");
    };

    reader.onerror = () => {
      alert("Failed to read file");
      setIsUploading(false);
    };

    try {
        reader.readAsText(file);
    } catch (err) {
        alert("Error reading file: " + err.message);
        setIsUploading(false);
    }
  };

  const findAnswerInDocuments = (query, docs) => {
    // Simple keyword-based 'AI' simulation
    const keywords = query.toLowerCase()
      .replace(/[?.,!]/g, '')
      .split(' ')
      .filter(w => w.length > 3 && !['what', 'where', 'when', 'who', 'how', 'does', 'this', 'that', 'with', 'from'].includes(w));

    if (keywords.length === 0) {
      return {
        answer: "Please ask a more specific question with keywords found in your documents.",
        sources: []
      };
    }

    let relevantChunks = [];
    
    docs.forEach(doc => {
      // Split content into paragraphs or roughly sentences
      const chunks = doc.content.split(/\n\s*\n/); // split by double newline for paragraphs
      
      chunks.forEach(chunk => {
        let score = 0;
        const lowerChunk = chunk.toLowerCase();
        
        keywords.forEach(keyword => {
          if (lowerChunk.includes(keyword)) {
            score += 1;
            // Bonus for exact matches or multiple occurrences
            const regex = new RegExp(`\\b${keyword}\\b`, "gi");
            const matches = lowerChunk.match(regex);
            if (matches) score += matches.length;
          }
        });

        if (score > 0) {
          relevantChunks.push({
            text: chunk.trim(),
            score: score,
            source: doc.name
          });
        }
      });
    });

    // Sort by score
    relevantChunks.sort((a, b) => b.score - a.score);
    const topChunks = relevantChunks.slice(0, 3);

    if (topChunks.length === 0) {
      return {
        answer: "I couldn't find any information dealing with that in your uploaded documents.",
        sources: []
      };
    }

    // Construct answer
    const combinedAnswer = topChunks.map(c => c.text).join("\n\n...\n\n");
    const uniqueSources = [...new Set(topChunks.map(c => c.source))].map(name => ({
      document: name,
      excerpt: "Referenced in answer generation."
    }));

    return {
      answer: combinedAnswer,
      sources: uniqueSources
    };
  };


  const handleGetAnswer = async () => {
    if (!question.trim()) {
      alert("Please ask a question");
      return;
    }

    if (uploadedDocuments.length === 0) {
      alert("Please upload some documents first.");
      return;
    }

    setIsAnswering(true);

    // Simulate AI processing delay
    setTimeout(() => {
      const result = findAnswerInDocuments(question, uploadedDocuments);
      setAnswer(result.answer);
      setSources(result.sources);
      setShowAnswer(true);
      setIsAnswering(false);
    }, 1500);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleDocumentClick = (doc) => {
    setSelectedDocument(doc);
  };

  const closeDocumentViewer = () => {
    setSelectedDocument(null);
  };

  return (
    <div className="container">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="title"
      >
        Private Knowledge Q&A
      </motion.h1>

      <div className="grid">
        {/* Left Panel */}
        <Card>
          <h2 className="section-title">Upload Document</h2>
          <input
            type="file"
            onChange={handleFileChange}
            className="file-input"
            disabled={isUploading}
            accept=".txt,.md,.json,.csv,.js,.html,.css" 
          />
          <Button onClick={handleUpload} disabled={isUploading} fullWidth>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>

          <h3 className="subsection-title">Uploaded Documents</h3>
          {uploadedDocuments.length === 0 ? (
            <p className="no-documents">No documents uploaded yet (Local Storage)</p>
          ) : (
            <div className="documents-container">
              {uploadedDocuments.map((doc) => (
                <div 
                  key={doc.id} 
                  className="document-card"
                  onClick={() => handleDocumentClick(doc)}
                >
                  <div className="document-header">
                    <div className="document-icon">📄</div>
                    <div className="document-info">
                      <p className="document-name">{doc.name}</p>
                      <p className="document-meta">
                        {formatFileSize(doc.size)} • {formatDate(doc.uploadedAt)}
                      </p>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDeleteDocument(e, doc.id)}
                      title="Delete document"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Panel */}
        <div className="right-panel">
          <Card>
            <h2 className="section-title">Ask a Question</h2>
            <div className="ask-box-wrapper">
              <div className="ask-input-container">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What would you like to know from your documents?"
                  className="ask-textarea"
                  rows={6}
                  disabled={isAnswering}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGetAnswer();
                    }
                  }}
                />
                <div className="ask-actions">
                  <span className="ask-hint">Shift + Enter for new line</span>
                  <Button onClick={handleGetAnswer} disabled={isAnswering} className="ask-submit-btn">
                    {isAnswering ? (
                      <>
                        <span className="animate-spin">↻</span> Processing...
                      </>
                    ) : (
                      <>
                        Get Answer <span className="arrow-icon">→</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {showAnswer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card>
                <h3 className="answer-title">Answer</h3>
                <div className="answer-content">
                  <p className="answer-text">{answer}</p>
                </div>
              </Card>

              {sources.length > 0 && (
                <Card>
                  <h3 className="answer-title">Sources</h3>
                  <div className="sources-list">
                    {sources.map((source, idx) => (
                      <div key={idx} className="source-chip">
                        <span className="source-icon">📄</span>
                        <span className="source-name">{source.document}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </motion.div>
          )}
        </div>

      </div>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={closeDocumentViewer}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{selectedDocument.name}</h2>
              <button 
                className="close-button" 
                onClick={closeDocumentViewer}
              >
                ✕
              </button>
            </div>
            <div className="modal-meta">
              <span>📊 {formatFileSize(selectedDocument.size)}</span>
              <span>📅 {formatDate(selectedDocument.uploadedAt)}</span>
            </div>
            <div className="document-content">
              <pre>{selectedDocument.content}</pre>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
