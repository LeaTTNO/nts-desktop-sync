import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, X, Plus, Minus } from "lucide-react";

export interface FarewisePassenger {
  type: number; // 0=adult, 1=child
  title: string;
  firstName: string;
  lastName: string;
  birthDate?: string; // YYYY-MM-DD, required for children under 12
}

export interface FarewiseBookingData {
  passengers: FarewisePassenger[];
  contacts: {
    email: string;
    phone: string;
    myRef?: string;
  };
}

interface FarewiseBookingModalProps {
  isOpen: boolean;
  isLoading: boolean;
  language: string;
  onConfirm: (data: FarewiseBookingData) => void;
  onClose: () => void;
}

const TITLES = ["Mr", "Mrs", "Ms", "Mstr", "Miss"];

export default function FarewiseBookingModal({
  isOpen,
  isLoading,
  language,
  onConfirm,
  onClose,
}: FarewiseBookingModalProps) {
  const [passengers, setPassengers] = useState<FarewisePassenger[]>([
    { type: 0, title: "Mr", firstName: "", lastName: "" },
  ]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [myRef, setMyRef] = useState("");

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPassengers([{ type: 0, title: "Mr", firstName: "", lastName: "" }]);
      setEmail("");
      setPhone("");
      setMyRef("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isNo = language !== "da";

  const addPassenger = (type: number) => {
    if (passengers.length >= 9) return;
    setPassengers([...passengers, { type, title: type === 0 ? "Mr" : "Mstr", firstName: "", lastName: "", ...(type === 1 ? { birthDate: "" } : {}) }]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length <= 1) return;
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  const updatePassenger = (index: number, field: keyof FarewisePassenger, value: string | number) => {
    setPassengers(passengers.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const adultsCount = passengers.filter(p => p.type === 0).length;
  const childrenCount = passengers.filter(p => p.type === 1).length;

  const isValid = passengers.every(p => {
    if (!p.firstName.trim() || !p.lastName.trim()) return false;
    if (p.type === 1 && !p.birthDate) return false;
    return true;
  });

  const handleConfirm = () => {
    onConfirm({
      passengers,
      contacts: { email: email.trim(), phone: phone.trim(), myRef: myRef.trim() },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Card className="w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <CardContent className="pt-5 pb-5 px-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {isNo ? "Book i Farewise" : "Book i Farewise"}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contact info */}
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {isNo ? "Kontaktinfo" : "Kontaktinfo"}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <input
              type="email"
              placeholder={isNo ? "E-post" : "Email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-8 text-sm px-2 rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="tel"
              placeholder={isNo ? "Mobiltelefon" : "Mobiltelefon"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
              className="h-8 text-sm px-2 rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              placeholder={isNo ? "Min ref" : "Min ref"}
              value={myRef}
              onChange={(e) => setMyRef(e.target.value)}
              disabled={isLoading}
              className="h-8 text-sm px-2 rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Passengers */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {isNo ? "Passasjerer" : "Passagerer"} ({adultsCount} {isNo ? "voksne" : "voksne"}{childrenCount > 0 ? `, ${childrenCount} ${isNo ? "barn" : "børn"}` : ""})
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => addPassenger(0)} disabled={isLoading || passengers.length >= 9}>
                <Plus className="h-3 w-3 mr-0.5" />{isNo ? "Voksen" : "Voksen"}
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => addPassenger(1)} disabled={isLoading || passengers.length >= 9}>
                <Plus className="h-3 w-3 mr-0.5" />{isNo ? "Barn" : "Barn"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {passengers.map((p, i) => (
              <div key={i} className="p-2 rounded bg-muted/40 border border-border/50">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground w-10 shrink-0">
                    {p.type === 0 ? (isNo ? "Voksen" : "Voksen") : (isNo ? "Barn" : "Barn")}
                  </span>
                  <select
                    value={p.title}
                    onChange={(e) => updatePassenger(i, "title", e.target.value)}
                    disabled={isLoading}
                    className="h-7 text-xs px-1 rounded border border-input bg-background text-foreground w-14 shrink-0"
                  >
                    {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder={isNo ? "Fornavn" : "Fornavn"}
                    value={p.firstName}
                    onChange={(e) => updatePassenger(i, "firstName", e.target.value)}
                    disabled={isLoading}
                    className="h-7 text-xs px-2 rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0"
                  />
                  <input
                    type="text"
                    placeholder={isNo ? "Etternavn" : "Efternavn"}
                    value={p.lastName}
                    onChange={(e) => updatePassenger(i, "lastName", e.target.value)}
                    disabled={isLoading}
                    className="h-7 text-xs px-2 rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0"
                  />
                  {passengers.length > 1 && (
                    <button onClick={() => removePassenger(i)} disabled={isLoading} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {p.type === 1 && (
                  <div className="flex items-center gap-1.5 mt-1.5 ml-10">
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {isNo ? "Fødselsdato:" : "Fødselsdato:"}
                    </span>
                    <input
                      type="date"
                      value={p.birthDate || ""}
                      onChange={(e) => updatePassenger(i, "birthDate", e.target.value)}
                      disabled={isLoading}
                      className="h-7 text-xs px-2 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={isLoading}>
              {isNo ? "Avbryt" : "Annuller"}
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={handleConfirm}
              disabled={isLoading || !isValid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isNo ? "Oppretter..." : "Opretter..."}
                </>
              ) : (
                isNo ? "Book i Farewise" : "Book i Farewise"
              )}
            </Button>
          </div>
          {!isValid && (
            <p className="text-[10px] text-destructive mt-1.5 text-center">
              {isNo ? "Alle passasjerer må ha fornavn og etternavn. Barn trenger fødselsdato." : "Alle passagerer skal have fornavn og efternavn. Børn kræver fødselsdato."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
