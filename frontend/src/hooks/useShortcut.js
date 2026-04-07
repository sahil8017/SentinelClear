import { useEffect } from 'react';

export function useShortcut(key, callback, modifier = 'ctrlKey') {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((modifier === 'none' && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === key.toLowerCase()) || 
          (modifier !== 'none' && event[modifier] && event.key.toLowerCase() === key.toLowerCase())) {
        event.preventDefault();
        callback();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, modifier]);
}
