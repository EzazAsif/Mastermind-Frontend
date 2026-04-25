import { useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { getAuth } from "firebase/auth";
import { use } from "react";

export default function ValidationModal({ isOpen, onClose, onSuccess }) {
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!transactionId.trim()) {
      alert("Enter transaction ID");
      return;
    }

    try {
      setLoading(true);

      const user = auth.currentUser;

      await axios.post(
        "https://ugliest-hannie-ezaz-307892de.koyeb.app/api/requests",
        {
          uid: user.uid,
          transactionId,
        },
      );

      onSuccess(); // refresh header state

      if (window.fbq) {
        fbq("track", "Purchase");
      }

      onClose();
      window.location.assign("https://academia.ictmastermind.com");
    } catch (err) {
      console.error(err);
      alert("Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-900 rounded-xl p-6 w-80 shadow-lg"
      >
        <h2 className="text-lg font-semibold mb-3 text-center">
          Get Subscribed
        </h2>

        {/* bKash Section */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <img src="/bkash-logo.png" alt="bKash" className="h-10" />
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            Payment <span className="font-semibold">350৳</span> to:
          </p>
          <p className="text-pink-600 font-bold text-lg">01611059617</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Enter Phone Nymber"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white py-2 rounded-md text-sm hover:bg-pink-700"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </form>

        <button onClick={onClose} className="mt-3 text-xs text-gray-500 w-full">
          Cancel
        </button>
      </motion.div>
    </div>
  );
}
