import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Hotel, Plane, Users, Baby } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TravelFormProps {
  language: 'no' | 'da';
}

const translations = {
  no: {
    title: "Lag Reiseprogram",
    subtitle: "Opprett ditt personlige safari- og Zanzibar-program",
    departureDate: "Utreisedato",
    safariDays: "Antall safaridager",
    hotelChoice: "Hotellvalg",
    zanzibarNights: "Antall netter på Zanzibar",
    adults: "Antall voksne (over 15 år)",
    children: "Antall barn (under 15 år)",
    childAge: "Alder på barn",
    childAgeOnTravel: "på utreisetidspunktet",
    generateProgram: "Generer Reiseprogram",
    selectHotel: "Velg hotell...",
    programGenerated: "Reiseprogram generert!",
    programDescription: "Ditt personlige reiseprogram er klart og kan eksporteres."
  },
  da: {
    title: "Lav Rejseprogram",
    subtitle: "Opret dit personlige safari- og Zanzibar-program",
    departureDate: "Afrejsedato",
    safariDays: "Antal safaridage",
    hotelChoice: "Hotelvalg",
    zanzibarNights: "Antal nætter på Zanzibar",
    adults: "Antal voksne (over 15 år)",
    children: "Antal børn (under 15 år)",
    childAge: "Alder på barn",
    childAgeOnTravel: "på afrejsetidspunktet",
    generateProgram: "Generer Rejseprogram",
    selectHotel: "Vælg hotel...",
    programGenerated: "Rejseprogram genereret!",
    programDescription: "Dit personlige rejseprogram er klar og kan eksporteres."
  }
};

const hotels = [
  { id: "serengeti-lodge", name: { no: "Serengeti Safari Lodge", da: "Serengeti Safari Lodge" } },
  { id: "ngorongoro-crater", name: { no: "Ngorongoro Crater Lodge", da: "Ngorongoro Crater Lodge" } },
  { id: "tarangire-camp", name: { no: "Tarangire Treetops Camp", da: "Tarangire Treetops Camp" } },
  { id: "manyara-lodge", name: { no: "Lake Manyara Lodge", da: "Lake Manyara Lodge" } }
];

export const TravelForm = ({ language }: TravelFormProps) => {
  const [formData, setFormData] = useState({
    departureDate: "",
    safariDays: "",
    hotel: "",
    zanzibarNights: "",
    adults: "2",
    children: "0",
    childrenAges: [] as number[]
  });
  
  const { toast } = useToast();
  const t = translations[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.departureDate || !formData.safariDays || !formData.hotel || !formData.zanzibarNights || !formData.adults) {
      return;
    }

    toast({
      title: t.programGenerated,
      description: t.programDescription,
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleChildrenCountChange = (value: string) => {
    const childrenCount = parseInt(value) || 0;
    setFormData(prev => ({ 
      ...prev, 
      children: value,
      childrenAges: Array(childrenCount).fill(0)
    }));
  };

  const handleChildAgeChange = (index: number, age: string) => {
    const ageNum = parseInt(age) || 0;
    setFormData(prev => ({
      ...prev,
      childrenAges: prev.childrenAges.map((currentAge, i) => 
        i === index ? ageNum : currentAge
      )
    }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-warm">
      <CardHeader className="text-center bg-gradient-sunset text-primary-foreground rounded-t-lg">
        <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
          <Plane className="h-6 w-6" />
          {t.title}
        </CardTitle>
        <p className="text-primary-foreground/90">{t.subtitle}</p>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="departure" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {t.departureDate}
              </Label>
              <Input
                id="departure"
                type="date"
                value={formData.departureDate}
                onChange={(e) => handleInputChange('departureDate', e.target.value)}
                className="border-muted focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="safari-days" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-safari-earth" />
                {t.safariDays}
              </Label>
              <Input
                id="safari-days"
                type="number"
                min="1"
                max="14"
                value={formData.safariDays}
                onChange={(e) => handleInputChange('safariDays', e.target.value)}
                className="border-muted focus:border-primary"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Hotel className="h-4 w-4 text-safari-grass" />
              {t.hotelChoice}
            </Label>
            <Select value={formData.hotel} onValueChange={(value) => handleInputChange('hotel', value)} required>
              <SelectTrigger className="border-muted focus:border-primary">
                <SelectValue placeholder={t.selectHotel} />
              </SelectTrigger>
              <SelectContent>
                {hotels.map((hotel) => (
                  <SelectItem key={hotel.id} value={hotel.id}>
                    {hotel.name[language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zanzibar-nights" className="flex items-center gap-2">
              🏝️ {t.zanzibarNights}
            </Label>
            <Input
              id="zanzibar-nights"
              type="number"
              min="0"
              max="14"
              value={formData.zanzibarNights}
              onChange={(e) => handleInputChange('zanzibarNights', e.target.value)}
              className="border-muted focus:border-primary"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="adults" className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t.adults}
              </Label>
              <Input
                id="adults"
                type="number"
                min="1"
                max="10"
                value={formData.adults}
                onChange={(e) => handleInputChange('adults', e.target.value)}
                className="border-muted focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="children" className="flex items-center gap-2">
                <Baby className="h-4 w-4 text-primary" />
                {t.children}
              </Label>
              <Input
                id="children"
                type="number"
                min="0"
                max="8"
                value={formData.children}
                onChange={(e) => handleChildrenCountChange(e.target.value)}
                className="border-muted focus:border-primary"
              />
            </div>
          </div>

          {parseInt(formData.children) > 0 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">
                {t.childAge} {t.childAgeOnTravel}:
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: parseInt(formData.children) }).map((_, index) => (
                  <div key={index} className="space-y-1">
                    <Label htmlFor={`child-${index}`} className="text-xs text-muted-foreground">
                      {t.childAge} {index + 1}
                    </Label>
                    <Input
                      id={`child-${index}`}
                      type="number"
                      min="0"
                      max="14"
                      value={formData.childrenAges[index] || ''}
                      onChange={(e) => handleChildAgeChange(index, e.target.value)}
                      className="border-muted focus:border-primary"
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-gradient-sunset hover:opacity-90 text-primary-foreground font-semibold py-3 shadow-warm"
          >
            {t.generateProgram}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};