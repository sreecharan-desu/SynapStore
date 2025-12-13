
"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const StickyScroll = ({
    content,
    contentClassName,
}: {
    content: {
        title: string;
        description: string;
        content?: React.ReactNode | any;
    }[];
    contentClassName?: string;
}) => {
    const [activeCard, setActiveCard] = React.useState(0);
    const ref = useRef<any>(null);
    const { scrollYProgress } = useScroll({
        // Using internal scroll tracking as per snippet
        container: ref,
        offset: ["start start", "end start"],
    });
    const cardLength = content.length;

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        const cardsBreakpoints = content.map((_, index) => index / cardLength);
        const closestBreakpointIndex = cardsBreakpoints.reduce(
            (acc, breakpoint, index) => {
                const distance = Math.abs(latest - breakpoint);
                if (distance < Math.abs(latest - cardsBreakpoints[acc])) {
                    return index;
                }
                return acc;
            },
            0,
        );
        setActiveCard(closestBreakpointIndex);
    });

    const backgroundColors = [
        "#f8fafc", // slate-50
        "#ffffff", // white
        "#f1f5f9", // slate-100
    ];
    const linearGradients = [
        "linear-gradient(to bottom right, #06b6d4, #10b981)",
        "linear-gradient(to bottom right, #ec4899, #6366f1)",
        "linear-gradient(to bottom right, #f97316, #eab308)",
    ];

    const [backgroundGradient, setBackgroundGradient] = useState(
        linearGradients[0],
    );

    useEffect(() => {
        setBackgroundGradient(linearGradients[activeCard % linearGradients.length]);
    }, [activeCard]);

    return (
        <motion.div
            animate={{
                backgroundColor: backgroundColors[activeCard % backgroundColors.length],
            }}
            className="h-[90vh] flex justify-center space-x-10 overflow-y-auto w-full scrollbar-hide p-10 relative rounded-[2rem]"
            ref={ref}
        >
            <div className="div relative flex items-start px-4 w-1/2">
                <div className="max-w-4xl">
                    {content.map((item, index) => (
                        <div key={item.title + index} className="my-20 min-h-[50vh] flex flex-col justify-center">
                            <motion.h2
                                initial={{
                                    opacity: 0,
                                }}
                                animate={{
                                    opacity: activeCard === index ? 1 : 0.3,
                                }}
                                className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight"
                            >
                                {item.title}
                            </motion.h2>
                            <motion.p
                                initial={{
                                    opacity: 0,
                                }}
                                animate={{
                                    opacity: activeCard === index ? 1 : 0.3,
                                }}
                                className="text-xl md:text-2xl mt-10 max-w-xl text-slate-600 leading-relaxed"
                            >
                                {item.description}
                            </motion.p>
                        </div>
                    ))}
                    <div className="h-40" />
                </div>
            </div>
            <motion.div
                animate={{ background: backgroundGradient }}
                className={cn(
                    "hidden lg:block h-[80vh] w-1/2 sticky top-10 overflow-hidden rounded-[2rem] bg-white shadow-xl",
                    contentClassName,
                )}
            >
                {content[activeCard].content ?? null}
            </motion.div>
        </motion.div>
    );
};

