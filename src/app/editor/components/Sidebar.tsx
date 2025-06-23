'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';

interface Document {
  id: string;
  title: string;
  content: string;
  lastModified?: Date;
  createdAt?: Date;
}

export default function Sidebar() {
  const { currentDoc, setCurrentDoc, documents, setDocuments, removeDocument, createNewDocument } = useEditorStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  const formatDate = (date: Date | undefined) => {
    if (!date || isNaN(date.getTime())) {
      return 'Just now';
    }
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    // For older dates, show the actual date
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const loadDocuments = async () => {
    if (!auth?.currentUser) {
      console.log('📚 Document load skipped - no authenticated user');
      return;
    }
    
    try {
      console.log('📚 Loading documents for user:', auth.currentUser.uid);
      setIsLoading(true);
      
      const response = await fetch(`/api/saveDoc?userId=${auth.currentUser.uid}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📚 Documents loaded successfully:', {
          count: data.documents?.length || 0,
          firstDoc: data.documents?.[0]?.id
        });
        
        if (data.documents) {
          const docs = data.documents.map((doc: any) => ({
            id: doc.id,
            title: doc.title || 'Untitled Document',
            content: doc.content || '',
            lastModified: doc.updatedAt ? new Date(doc.updatedAt) : (doc.createdAt ? new Date(doc.createdAt) : new Date()),
            createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date()
          }));

          // Always sort documents client-side to ensure consistent order
          docs.sort((a: Document, b: Document) => {
            const dateA = a.lastModified || a.createdAt;
            const dateB = b.lastModified || b.createdAt;
            // Ensure we have valid dates before comparing
            if (dateA && dateB) {
              return dateB.getTime() - dateA.getTime();
            }
            return 0; // Or handle as per your logic if dates can be null
          });

          setDocuments(docs);

          // If no current document is selected, select the most recent one
          if (!currentDoc && docs.length > 0) {
            setCurrentDoc(docs[0]);
          }
        } else {
          setDocuments([]); // Ensure documents is always an array
        }
      } else {
        const errorData = await response.json();
        console.error('📚 Failed to load documents:', {
          status: response.status,
          error: errorData
        });
        setDocuments([]); // Ensure documents is always an array
      }
    } catch (error) {
      console.error('📚 Error loading documents:', error);
      setDocuments([]); // Ensure documents is always an array
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent document selection when clicking delete
    setDeletingDoc(docId);

    if (!auth?.currentUser) return;
    
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      setDeletingDoc(null);
      return;
    }

    try {
      console.log('🗑️ Deleting document:', docId);
      const response = await fetch(`/api/saveDoc?userId=${auth.currentUser.uid}&docId=${docId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log('✅ Document deleted successfully:', docId);
        
        // Remove from local store
        removeDocument(docId);
        
        // If we deleted the current document, select another one
        if (currentDoc?.id === docId) {
          const remainingDocs = (documents || []).filter(d => d.id !== docId);
          setCurrentDoc(remainingDocs.length > 0 ? remainingDocs[0] : null);
        }

        // Reload documents list from server to ensure sync
        await loadDocuments();
      } else {
        const error = await response.json();
        console.error('❌ Failed to delete document:', error);
        alert('Failed to delete document. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setDeletingDoc(null);
    }
  };

  // Load user's documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const selectDocument = async (doc: Document) => {
    if (!auth?.currentUser) return;

    try {
      console.log('📚 Loading document:', doc.id);
      const response = await fetch(`/api/saveDoc?userId=${auth.currentUser.uid}&docId=${doc.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.document) {
          const loadedDoc = {
            id: data.document.id,
            title: data.document.title || 'Untitled Document',
            content: data.document.content || '',
            lastModified: data.document.lastModified ? new Date(data.document.lastModified) : new Date(data.document.createdAt),
            createdAt: data.document.createdAt ? new Date(data.document.createdAt) : new Date()
          };
          console.log('📚 Document loaded successfully:', {
            id: loadedDoc.id,
            title: loadedDoc.title,
            contentLength: loadedDoc.content.length
          });
          setCurrentDoc(loadedDoc);
        }
      } else {
        console.error('📚 Failed to load document:', doc.id);
      }
    } catch (error) {
      console.error('📚 Error loading document:', error);
    }
  };

  return (
    <div className={`h-full flex flex-col bg-slate-900 text-white transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          variant="ghost"
          className="w-full justify-start text-white hover:bg-slate-800"
        >
          <svg
            className={`w-6 h-6 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
            />
          </svg>
          {!isCollapsed && <span className="ml-2">Documents</span>}
        </Button>

        {!isCollapsed && (
          <Button
            onClick={() => {
              if (!auth?.currentUser) return;
              const newDoc: Document = {
                id: crypto.randomUUID(),
                title: 'Untitled Document',
                content: '',
                lastModified: new Date(),
                createdAt: new Date()
              };
              setDocuments([newDoc, ...(documents || [])]);
              setCurrentDoc(newDoc);
            }}
            variant="ghost"
            className="w-full mt-4 justify-start text-white hover:bg-slate-800"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Document
          </Button>
        )}
      </div>

      {/* Scrollable Document List */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-slate-400">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading documents...
              </div>
            ) : !documents || documents.length === 0 ? (
              <div className="text-center py-4 text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No documents yet</p>
                <p className="text-sm mt-1">Create a new document to get started</p>
              </div>
            ) : (
              documents.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => setCurrentDoc(doc)}
                  className={`group p-3 rounded-lg cursor-pointer transition-all hover:shadow-lg ${
                    currentDoc?.id === doc.id
                      ? 'bg-slate-700 text-white shadow-md'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate flex-1 mr-2">{doc.title}</div>
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded ${
                        deletingDoc === doc.id ? 'opacity-100' : ''
                      }`}
                      disabled={deletingDoc === doc.id}
                    >
                      {deletingDoc === doc.id ? (
                        <svg className="animate-spin h-4 w-4 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg 
                          className="w-4 h-4 text-red-400" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {formatDate(doc.lastModified)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}