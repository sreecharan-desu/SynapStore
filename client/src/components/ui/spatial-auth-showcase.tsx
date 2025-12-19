import type { ReactNode } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

// =========================================
// 1. CONFIGURATION & DATA TYPES
// =========================================

export type AuthMode = 'login' | 'signup';

// =========================================
// 2. ANIMATION VARIANTS
// =========================================

const ANIMATIONS = {
    container: {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.1 },
        },
        exit: {
            opacity: 0,
            transition: { duration: 0.2 },
        },
    },
    item: {
        hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
        visible: {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            transition: { type: 'spring', stiffness: 100, damping: 20 } as const,
        },
        exit: { opacity: 0, y: -10, filter: 'blur(5px)' },
    },
    visual: (): Variants => ({
        initial: {
            opacity: 0,
            scale: 1.5,
            filter: 'blur(15px)',
        },
        animate: {
            opacity: 1,
            scale: 1,
            filter: 'blur(0px)',
            transition: { type: 'spring', stiffness: 260, damping: 20 } as const,
        },
        exit: {
            opacity: 0,
            scale: 0.6,
            filter: 'blur(20px)',
            transition: { duration: 0.25 },
        },
    }),
};

// =========================================
// 3. SUB-COMPONENTS
// =========================================

const BackgroundGradient = ({ isLogin }: { isLogin: boolean }) => (
    <div className="fixed inset-0 pointer-events-none">
        <motion.div
            animate={{
                background: isLogin
                    ? 'radial-gradient(circle at 0% 50%, rgba(16, 185, 129, 0.15), transparent 50%)' // Emerald/Green for Login
                    : 'radial-gradient(circle at 100% 50%, rgba(59, 130, 246, 0.15), transparent 50%)', // Blue for Signup
            }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-white/50 bg-[url('/grid.svg')] opacity-20" />
    </div>
);

const AuthVisual = ({ isLogin, visualComponent }: { isLogin: boolean; visualComponent: ReactNode }) => (
    <motion.div layout="position" className="relative group shrink-0">

        {/* 3D Container - Removed Circles/Rings */}
        <div className="relative h-80 w-80 md:h-[450px] md:w-[450px] flex items-center justify-center">
            <motion.div
                animate={{ y: [-10, 10, -10] }}
                transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
                className="relative z-10 w-full h-full flex items-center justify-center"
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={isLogin ? 'login' : 'signup'}
                        variants={ANIMATIONS.visual()}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="w-full h-full"
                    >
                        {visualComponent}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>

        {/* Status Label */}
        <motion.div
            layout="position"
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-600 bg-emerald-50/80 px-4 py-2 rounded-full border border-emerald-100 backdrop-blur shadow-sm">
                <span className={`h-1.5 w-1.5 rounded-full ${isLogin ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`} />
                {isLogin ? 'Welcome Back' : 'Join Us Today'}
            </div>
        </motion.div>
    </motion.div>
);

const AuthContent = ({ isLogin, children }: { isLogin: boolean; children: ReactNode }) => {
    // Determine alignment based on mode
    const alignClass = isLogin ? 'items-start text-left' : 'items-end text-right';

    return (
        <motion.div
            variants={ANIMATIONS.container}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`flex flex-col w-full ${alignClass}`}
        >
            <motion.h2 variants={ANIMATIONS.item} className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
                SynapStore
            </motion.h2>

            <motion.h1 variants={ANIMATIONS.item} className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-500">
                {isLogin ? 'Authentication' : 'Registration'}
            </motion.h1>

            <motion.div variants={ANIMATIONS.item} className={`text-slate-500 mb-8 max-w-md leading-relaxed ${isLogin ? 'mr-auto' : 'ml-auto'}`}>
                {isLogin
                    ? "Securely access your dashboard and manage your store's intelligence."
                    : "Create your account to start leveraging AI-driven insights for your business."}
            </motion.div>

            {/* Form Container */}
            <motion.div variants={ANIMATIONS.item} className="w-full bg-white/60 p-1 md:p-2 rounded-3xl border border-white/50 backdrop-blur-md shadow-xl ring-1 ring-black/5">
                {children}
            </motion.div>
        </motion.div>
    );
};

const Switcher = ({
    activeMode,
    onToggle
}: {
    activeMode: AuthMode;
    onToggle: (mode: AuthMode) => void
}) => {
    return (
        <div className="fixed bottom-8 inset-x-0 flex justify-center z-50 pointer-events-none">
            <motion.div layout className="pointer-events-auto flex items-center gap-1 p-1.5 rounded-full bg-white/80 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.1)] ring-1 ring-black/5">
                {[
                    { id: 'login', label: 'Login' },
                    { id: 'signup', label: 'Signup' }
                ].map((opt) => (
                    <motion.button
                        key={opt.id}
                        onClick={() => onToggle(opt.id as AuthMode)}
                        whileTap={{ scale: 0.96 }}
                        className="relative w-28 h-12 rounded-full flex items-center justify-center text-sm font-medium focus:outline-none"
                    >
                        {activeMode === opt.id && (
                            <motion.div
                                layoutId="island-surface"
                                className="absolute inset-0 rounded-full bg-emerald-600 shadow-lg"
                                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                            />
                        )}
                        <span className={`relative z-10 transition-colors duration-300 ${activeMode === opt.id ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                            {opt.label}
                        </span>
                    </motion.button>
                ))}
            </motion.div>
        </div>
    );
};

// =========================================
// 4. MAIN COMPONENT WRAPPER
// =========================================

interface SpatialAuthShowcaseProps {
    mode: AuthMode;
    setMode: (mode: AuthMode) => void;
    visualComponent: ReactNode; // The 3D Character
    children: ReactNode; // The Form
}

export default function SpatialAuthShowcase({ mode, setMode, visualComponent, children }: SpatialAuthShowcaseProps) {
    const isLogin = mode === 'login';

    return (
        <div className="relative min-h-screen w-full bg-slate-50 text-slate-900 overflow-hidden selection:bg-emerald-100 flex flex-col items-center justify-center">

            <BackgroundGradient isLogin={isLogin} />

            <main className="relative z-10 w-full px-4 py-8 flex flex-col justify-center max-w-7xl mx-auto h-full min-h-screen">
                <motion.div
                    layout
                    transition={{ type: 'spring', bounce: 0, duration: 0.9 }}
                    className={`flex flex-col md:flex-row items-center justify-center gap-8 md:gap-20 lg:gap-32 w-full ${isLogin ? 'md:flex-row' : 'md:flex-row-reverse'
                        }`}
                >
                    {/* Left/Right Column: Visuals */}
                    <AuthVisual isLogin={isLogin} visualComponent={visualComponent} />

                    {/* Right/Left Column: Content (Forms) */}
                    <motion.div layout="position" className="w-full max-w-md shrink-0">
                        <AnimatePresence mode="wait">
                            <AuthContent
                                // Force re-render key for animation text changes, but we might want to keep form state?
                                // Actually, if we change key, we lose form state.
                                // But the user requested "Login and Signup" switcher, which usually implies switching modes.
                                // In Login.tsx we share state or swap forms. Since `mode` prop controls it, let's let logical parent handle form content.
                                // We WON'T key the AuthContent itself to destroy children, but we rely on children changing.
                                key={mode}
                                isLogin={isLogin}
                            >
                                {children}
                            </AuthContent>
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            </main>

            <Switcher activeMode={mode} onToggle={setMode} />
        </div>
    );
}
