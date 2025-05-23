"use client";

import { ImageUploadArea } from "@/components/features/image-upload/ImageUploadArea";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 bg-background text-foreground font-[family-name:var(--font-geist-sans)]">
      <header className="mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-primary">
          IMG Enhancify
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Upload and enhance the quality of your images with ease.
        </p>
      </header>
      <main className="w-full max-w-2xl flex flex-col items-center gap-6">
        <ImageUploadArea />
      </main>
    </div>
  );
}
