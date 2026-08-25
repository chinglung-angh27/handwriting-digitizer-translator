
import React from 'react';

interface LoaderProps {
  message: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 border-4 border-t-indigo-500 border-r-indigo-500 border-b-indigo-500 border-l-slate-200 rounded-full animate-spin mb-6"></div>
      <h2 className="text-xl font-semibold text-slate-700">{message}</h2>
    </div>
  );
};