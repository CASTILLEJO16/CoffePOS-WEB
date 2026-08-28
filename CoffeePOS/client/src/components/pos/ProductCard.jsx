import { useState } from 'react';
import { Coffee } from 'lucide-react';
import './ProductCard.css';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { getImageUrl as getImageSrc } from '../../utils/constants.js';

export default function ProductCard({ product, onClick }) {
  const [imgError, setImgError] = useState(false);

  const imgSrc = product.imagen && !imgError ? getImageSrc(product.imagen) : null;

  return (
    <div className="product-card" onClick={() => onClick(product)}>
      <div className="product-image">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.nombre}
            className="product-img-element"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="product-icon">
            <Coffee size={32} />
          </div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.nombre}</h3>
        <p className="product-price">{formatCurrency(product.precio)}</p>
      </div>
    </div>
  );
}
