import { Modifier } from '@dnd-kit/core';

const GRID_SIZE = 54; // Assumes model icons are roughly 50x50 with some margin

export const snapToGrid: Modifier = ({ transform }) => {
  // Only snap to grid on drop (modifier is called after drag ends)
  
  const x = Math.round(transform.x / GRID_SIZE) * GRID_SIZE;
  const y = Math.round(transform.y / GRID_SIZE) * GRID_SIZE;
  
  return {
    ...transform,
    x,
    y,
  };
};

// Allow free movement during drag
export const freeDrag: Modifier = ({ transform }) => {
  return transform;
}; 