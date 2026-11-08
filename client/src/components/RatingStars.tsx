import { Star } from "lucide-react";

type RatingStarsProps = {
  average: number;
  size?: number;
};

export default function RatingStars({ average, size = 15 }: RatingStarsProps) {
  const rounded = Math.round(average);
  return <span className="rating-stars" role="img" aria-label={`${average.toFixed(1)} de 5 estrelas`}>
    {[1, 2, 3, 4, 5].map(value => <Star key={value} className={value <= rounded ? "filled" : ""} size={size} />)}
  </span>;
}
