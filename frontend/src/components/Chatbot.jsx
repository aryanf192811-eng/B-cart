import React, { useState } from 'react';
import Drawer from './Drawer';
import { api } from '../api/client';
import { E } from '../api/endpoints';
import { Bot, Send } from 'lucide-react';

export default function Chatbot({ isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('');

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await api.post(E.chat(), { message: userMsg });
      if (res.data.source && !source) setSource(res.data.source);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response || res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const downloadSnapshot = () => {
    window.open(`${import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'}${E.chatSnapshot()}`, '_blank');
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Operations assistant"
      subtitle={
        <div className="flex items-center gap-1.5 mt-1">
          <Bot size={12} className="text-rust" />
          <span className="font-mono text-[10px] tracking-wider text-steel uppercase">
            {source === 'groq' ? 'powered by Groq AI' : (source ? 'offline mode · JSON fallback' : 'Ready')}
          </span>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Message List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-steel2 text-sm text-center px-6">
              <Bot size={32} strokeWidth={1} className="mb-3 opacity-50" />
              <p>Ask me about inventory, bottlenecks, or order statuses.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] px-4 py-2.5 text-[13px] leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-ink text-white rounded-t-md rounded-bl-md' 
                      : 'bg-paper2 text-ink border-[0.5px] border-rule rounded-t-md rounded-br-md'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-paper2 text-steel border-[0.5px] border-rule rounded-t-md rounded-br-md px-4 py-2.5 text-[13px] animate-pulse">
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="pt-4 border-t-[0.5px] border-rule bg-white flex flex-col gap-2">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about operations... (Cmd+Enter to send)"
              className="field w-full min-h-[80px] max-h-[200px] py-2.5 pr-10 resize-none text-[13px]"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="absolute right-2 bottom-2 p-1.5 text-white bg-rust rounded hover:bg-rust2 disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
          <button 
            onClick={downloadSnapshot}
            className="text-[11px] text-steel hover:text-ink text-left inline-flex items-center"
          >
            Download snapshot.json ↗
          </button>
        </div>
      </div>
    </Drawer>
  );
}
