'use client';
import Image from 'next/image';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
export function PokemonArtwork({
  src,
  name,
  priority = false,
}: {
  src: string | null;
  name: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="artwork">
      {src && !failed ? (
        <Image
          src={src}
          alt={`Ilustração de ${name}`}
          fill
          sizes="(max-width: 640px) 75vw, (max-width: 1023px) 45vw, 400px"
          priority={priority}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="artwork-fallback">
          <ImageOff size={44} aria-hidden="true" />
          <span>Ilustração indisponível</span>
        </div>
      )}
    </div>
  );
}
