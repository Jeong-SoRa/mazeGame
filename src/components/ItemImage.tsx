import { useState } from 'react';

interface ItemImageProps {
  itemId: string;
  emoji: string;
  size?: number;
  style?: React.CSSProperties;
}

export function ItemImage({ itemId, emoji, size = 20, style }: ItemImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span style={{ fontSize: size, lineHeight: 1, ...style }}>{emoji}</span>;
  }

  return (
    <img
      src={`/items/${itemId}.png`}
      alt={emoji}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ objectFit: 'contain', verticalAlign: 'middle', ...style }}
    />
  );
}
