'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type FeedbackType = 'up' | 'down';

type Props = {
    visible: boolean;
    onClose: () => void;
    onFeedback?: (type: FeedbackType, reason?: string) => void;
    message?: string;
};

const FEEDBACK_CLOSE_DELAY = 1500; // ms

export default function FeedbackToast({ visible, onClose, onFeedback, message = "Was this helpful?" }: Props) {
    const [selected, setSelected] = useState<FeedbackType | null>(null);
    const [showReasonInput, setShowReasonInput] = useState(false);
    const [reason, setReason] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const closeAfterDelay = () => {
        setTimeout(onClose, FEEDBACK_CLOSE_DELAY);
    };

    const handleThumb = (type: FeedbackType) => {
        setSelected(type);

        if (type === 'up') {
            onFeedback?.('up');
            setSubmitted(true);
            closeAfterDelay();
        } else {
            setShowReasonInput(true);
        }
    };

    const handleSubmit = () => {
        onFeedback?.('down', reason);
        setSubmitted(true);
        closeAfterDelay();
    };

    const handleSkip = () => {
        onFeedback?.('down');
        setSubmitted(true);
        closeAfterDelay();
    };

    const handleBack = () => {
        setSelected(null);
        setShowReasonInput(false);
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="fixed right-4 bottom-4 z-50 w-full max-w-sm"
                >
                    <motion.div
                        layout
                        className="bg-white border-slate-200 overflow-hidden rounded-xl border p-4 shadow-xl"
                    >
                        {!submitted ? (
                            <>
                                {selected === null && (
                                    <motion.div layout className="flex items-center justify-between">
                                        <p className="text-slate-800 text-sm font-medium">{message}</p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Thumbs up"
                                                onClick={() => handleThumb('up')}
                                                className="cursor-pointer hover:bg-black"
                                            >
                                                <ThumbsUp className="h-4 w-4 text-emerald-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Thumbs down"
                                                onClick={() => handleThumb('down')}
                                                className="cursor-pointer hover:bg-red-50"
                                            >
                                                <ThumbsDown className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}

                                {selected === 'down' && showReasonInput && (
                                    <motion.div layout className="mt-2 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-slate-800 text-sm font-medium">What could be better?</p>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                aria-label="Close"
                                                onClick={onClose}
                                                className="text-slate-400 hover:text-slate-800 cursor-pointer"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <Textarea
                                            placeholder="Share your reason (optional)"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="w-full resize-none border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                                            rows={3}
                                        />

                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    aria-label="Back"
                                                    onClick={handleBack}
                                                    className="cursor-pointer"
                                                >
                                                    <ArrowLeft className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="link"
                                                    onClick={handleSkip}
                                                    className="text-slate-500 hover:text-slate-800 cursor-pointer px-0"
                                                >
                                                    Skip
                                                </Button>
                                            </div>
                                            <Button onClick={handleSubmit} className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white">
                                                Submit
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </>
                        ) : (
                            <motion.p layout className="text-slate-800 text-sm font-medium flex items-center gap-2">
                                <span className="text-emerald-500 bg-black p-1 rounded-full"><CheckCircle className="w-4 h-4" /></span> Thanks for the feedback!
                            </motion.p>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

import { CheckCircle } from 'lucide-react';
