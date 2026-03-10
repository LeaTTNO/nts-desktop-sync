import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";

interface FarewiseBookingModalProps {
  isOpen: boolean;
  isLoading: boolean;
  language: string;
  onConfirm: (adults: number, children: number) => void;
  onClose: () => void;
}

export default function FarewiseBookingModal({
  isOpen,
  isLoading,
  language,
  onConfirm,
  onClose,
}: FarewiseBookingModalProps) {
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  if (!isOpen) return null;

  const isNo = language !== "da";
  const title = isNo ? "Book i Farewise" : "Book i Farewise";
  const passengersLabel = isNo ? "Passasjerer" : "Passagerer";
  const adultsLabel = isNo ? "Voksne" : "Voksne";
  const childrenLabel = isNo ? "Barn" : "Børn";
  const confirmLabel = isNo ? "Book i Farewise" : "Book i Farewise";
  const cancelLabel = isNo ? "Avbryt" : "Annuller";

  const handleConfirm = () => {
    onConfirm(adults, children);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-sm mx-4 shadow-xl">
        <CardContent className="pt-5 pb-5 px-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Passenger counts */}
          <p className="text-sm text-muted-foreground mb-3">{passengersLabel}</p>

          <div className="flex flex-col gap-3 mb-5">
            {/* Adults */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{adultsLabel}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setAdults((n) => Math.max(1, n - 1))}
                  disabled={isLoading}
                >
                  –
                </Button>
                <span className="text-sm font-medium w-4 text-center">{adults}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setAdults((n) => Math.min(9, n + 1))}
                  disabled={isLoading}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Children */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{childrenLabel}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setChildren((n) => Math.max(0, n - 1))}
                  disabled={isLoading}
                >
                  –
                </Button>
                <span className="text-sm font-medium w-4 text-center">{children}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setChildren((n) => Math.min(8, n + 1))}
                  disabled={isLoading}
                >
                  +
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isNo ? "Oppretter..." : "Opretter..."}
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
