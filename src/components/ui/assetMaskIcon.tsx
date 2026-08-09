import React from "react";

type AssetMaskIconProps = {
  src: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export default function AssetMaskIcon({
  src,
  size = 20,
  className = "",
  style,
}: AssetMaskIconProps) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        ...style,
        width: size,
        height: size,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
