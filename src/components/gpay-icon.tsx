import Image from "next/image";

export function GPayIcon({ className = "size-5" }: { className?: string }) {
  return (
    <Image
      src="/gpay-icon.png"
      alt="Google Pay"
      width={100}
      height={100}
      unoptimized
      className={`inline-block shrink-0 object-contain ${className}`}
    />
  );
}
