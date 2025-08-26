import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase'; // Assuming you have a firebase config file
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const ApplyCorsPage: React.FC = () => {
  const [bucketName, setBucketName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApplyCors = async () => {
    if (!bucketName) {
      setStatus('Please enter a bucket name.');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const functions = getFunctions();
      const setCorsConfiguration = httpsCallable(functions, 'setCorsConfiguration');
      await setCorsConfiguration({ bucketName: bucketName });
      setStatus('CORS configuration applied successfully.');
    } catch (error) {
      console.error("Error applying CORS:", error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">Apply CORS to GCS Bucket</h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Enter the name of your Google Cloud Storage bucket to apply the necessary CORS settings for web fonts.
        </p>
        <div className="mb-4">
          <label htmlFor="bucketName" className="block text-sm font-medium text-gray-700 mb-1">
            Bucket Name
          </label>
          <input
            type="text"
            id="bucketName"
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="your-bucket-name.appspot.com"
          />
        </div>
        <button
          onClick={handleApplyCors}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
        >
          {loading ? 'Applying...' : 'Apply CORS'}
        </button>
        {status && (
          <p className={`mt-4 text-sm text-center ${status.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {status}
          </p>
        )}
         <div className="mt-6 p-4 bg-gray-50 rounded-md border">
          <h2 className="text-lg font-semibold mb-2">Why is this needed?</h2>
          <p className="text-sm text-gray-700">
            Google Cloud Storage requires CORS (Cross-Origin Resource Sharing) to be configured to allow web pages from different domains (like your app) to load resources like custom fonts. This page calls a secure Cloud Function that updates your bucket's settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApplyCorsPage;
