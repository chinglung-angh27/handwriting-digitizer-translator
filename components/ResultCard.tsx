
import React, { useState, useCallback } from 'react';
import { CopyIcon, CheckIcon } from './Icons';

interface ResultCardProps {
  title: string;
  content: string;
}

export const ResultCard: React.FC<ResultCardProps> = ({ title, content }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [content]);

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-lg h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-indigo-600">{title}</h3>
        <button
            onClick={handleCopy}
            className="p-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors duration-200 flex items-center gap-2"
            aria-label="Copy text"
        >
            {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      <div className="flex-grow overflow-y-auto bg-slate-50 border border-slate-100 p-4 rounded-md">
        <p className="text-slate-800 whitespace-pre-wrap">{content || "No content available."}</p>
      </div>
    </div>
  );
};