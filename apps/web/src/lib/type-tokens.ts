import type { PokemonType } from '@pokelab/pokemon-domain';
// All badge text uses ink, ensuring readable contrast on the approved soft palette.
export const POKEMON_TYPE_TOKENS = {
  normal: { label: 'Normal', solid: '#8E969F', soft: '#F0F1F3' },
  fire: { label: 'Fogo', solid: '#F16B3A', soft: '#FFF0E8' },
  water: { label: 'Água', solid: '#3195E9', soft: '#E8F5FF' },
  electric: { label: 'Elétrico', solid: '#E6A500', soft: '#FFF5CD' },
  grass: { label: 'Planta', solid: '#35A85D', soft: '#E6F8E9' },
  ice: { label: 'Gelo', solid: '#29AEBE', soft: '#E6FAFC' },
  fighting: { label: 'Lutador', solid: '#C7534E', soft: '#FCEAE8' },
  poison: { label: 'Veneno', solid: '#9655CD', soft: '#F2E9FD' },
  ground: { label: 'Terra', solid: '#B88049', soft: '#F8EDDF' },
  flying: { label: 'Voador', solid: '#7589D7', soft: '#EEF0FF' },
  psychic: { label: 'Psíquico', solid: '#EE638A', soft: '#FFEBF2' },
  bug: { label: 'Inseto', solid: '#80A43B', soft: '#F2F7E5' },
  rock: { label: 'Pedra', solid: '#AA8747', soft: '#F6F0E4' },
  ghost: { label: 'Fantasma', solid: '#7959AE', soft: '#F0EAFA' },
  dragon: { label: 'Dragão', solid: '#695BD9', soft: '#EEECFF' },
  dark: { label: 'Sombrio', solid: '#55586A', soft: '#ECEEF2' },
  steel: { label: 'Aço', solid: '#728D9F', soft: '#EAF1F5' },
  fairy: { label: 'Fada', solid: '#D87DB2', soft: '#FCEAF6' },
} satisfies Record<PokemonType, { label: string; solid: string; soft: string }>;
