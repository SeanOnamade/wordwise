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
  const { currentDoc, setCurrentDoc, documents, setDocuments, removeDocument } = useEditorStore();
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
        removeDocument(docId);
        
        // If we deleted the current document, select another one
        if (currentDoc?.id === docId) {
          const remainingDocs = (documents || []).filter(d => d.id !== docId);
          setCurrentDoc(remainingDocs.length > 0 ? remainingDocs[0] : null);
        }
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

  // Load user's documents
  useEffect(() => {
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
              lastModified: doc.updatedAt ? new Date(doc.updatedAt) : undefined,
              createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined
            }));
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
            lastModified: data.document.updatedAt ? new Date(data.document.updatedAt) : undefined,
            createdAt: data.document.createdAt ? new Date(data.document.createdAt) : undefined
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

  const createNewDocument = async () => {
    if (!auth?.currentUser) {
      console.log('📝 Cannot create document - no authenticated user');
      return;
    }

    const newDoc: Document = {
      id: crypto.randomUUID(),
      title: 'Untitled Document',
      content: '',
      lastModified: new Date(),
      createdAt: new Date()
    };

    try {
      console.log('📝 Creating new document:', {
        id: newDoc.id,
        userId: auth.currentUser.uid
      });

      const response = await fetch('/api/saveDoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          docId: newDoc.id,
          title: newDoc.title,
          content: newDoc.content || '' // Ensure content is never undefined
        }),
      });

      if (response.ok) {
        console.log('📝 Document created successfully:', newDoc.id);
        setDocuments([newDoc, ...(documents || [])]);
        setCurrentDoc(newDoc); // Set as current document immediately
      } else {
        const errorData = await response.json();
        console.error('📝 Failed to create document:', {
          status: response.status,
          error: errorData
        });
      }
    } catch (error) {
      console.error('📝 Error creating document:', error);
    }
  };

  return (
    <div className={`h-full bg-slate-900 text-white transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="p-4">
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
          <>
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

            <div className="mt-6 space-y-2">
              {isLoading ? (
                <div className="text-center text-slate-400">Loading documents...</div>
              ) : !documents || documents.length === 0 ? (
                <div className="text-center text-slate-400">No documents yet</div>
              ) : (
                documents.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => setCurrentDoc(doc)}
                    className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                      currentDoc?.id === doc.id
                        ? 'bg-slate-700 text-white'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{doc.title}</div>
                      <button
                        onClick={(e) => handleDeleteDocument(doc.id, e)}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded ${
                          deletingDoc === doc.id ? 'opacity-100' : ''
                        }`}
                        disabled={deletingDoc === doc.id}
                      >
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
                      </button>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {formatDate(doc.lastModified)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}