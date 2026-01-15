import { useLanguage } from "@/contexts/LanguageContext";
import { SupportedLanguage } from "@/translations/translations";

interface LanguageToggleProps {
  language?: SupportedLanguage;
  onLanguageChange?: (language: SupportedLanguage) => void;
}

export const LanguageToggle = ({ language: propLanguage, onLanguageChange }: LanguageToggleProps) => {
  const { language: contextLanguage, setLanguage } = useLanguage();
  
  const currentLanguage = propLanguage ?? contextLanguage;
  const handleChange = onLanguageChange ?? setLanguage;

  return (
    <div className="tts-language">
      <button
        className={`lang-btn ${currentLanguage === 'no' ? 'active' : ''}`}
        onClick={() => handleChange('no')}
      >
        NO
      </button>
      <button
        className={`lang-btn ${currentLanguage === 'da' ? 'active' : ''}`}
        onClick={() => handleChange('da')}
      >
        DK
      </button>
    </div>
  );
};