import { useState, useEffect } from 'react';

const HackathonCard = ({ hackathon, onClick, isRegistered }) => {
  const [logoError, setLogoError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  
  // Reset error state when hackathon changes
  useEffect(() => {
    setLogoError(false);
    setShowFallback(false);
  }, [hackathon.id || hackathon._id]);
  
  // Reset error state when hackathon changes
  useEffect(() => {
    setLogoError(false);
    setShowFallback(false);
  }, [hackathon.id || hackathon._id]);

  // Extract domain from URL for Clearbit fallback
  const extractDomain = (url) => {
    if (!url) return null;
    try {
      let domain = url.replace(/^https?:\/\//, '');
      domain = domain.replace(/^www\./, '');
      domain = domain.split('/')[0];
      domain = domain.split(':')[0];
      return domain;
    } catch (error) {
      console.error('Error extracting domain:', error);
      return null;
    }
  };

  // Get image URL with priority: imageUrl > Clearbit > null
  const getImageUrl = () => {
    // Priority 1: Use imageUrl field if it exists (manually added to MongoDB)
    if (hackathon.imageUrl) {
      return hackathon.imageUrl;
    }
    
    // Also check logo field as fallback
    if (hackathon.logo) {
      return hackathon.logo;
    }
    
    // Priority 2: Fallback to Clearbit Logo API
    const domain = extractDomain(hackathon.url);
    if (domain) {
      return `https://logo.clearbit.com/${domain}?size=128`;
    }
    
    // Priority 3: Return null to show placeholder
    return null;
  };

  const imageUrl = getImageUrl();
  
  // Debug: Log hackathon data (only log when imageUrl exists to reduce console noise)
  useEffect(() => {
    if (hackathon.imageUrl) {
      console.log('🔍 Frontend: Hackathon with imageUrl:', hackathon.name, 'URL:', hackathon.imageUrl);
    }
  }, [hackathon.imageUrl]);
  const hackathonId = hackathon.id || hackathon._id;
  const firstLetter = hackathon.name?.charAt(0)?.toUpperCase() || 'H';

  const handleImageError = () => {
    setLogoError(true);
    setShowFallback(true);
  };

  // Helper function for date formatting
  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate && !endDate) return 'Date TBD';
    if (!startDate) return `Until ${formatDate(endDate)}`;
    if (!endDate) return `From ${formatDate(startDate)}`;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // If same month, show: "Jan 15-17, 2026"
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
    }
    
    // Different months: "Jan 15 - Feb 2, 2026"
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  return (
    <div
      onClick={onClick}
      className="group code-bg transition-all duration-300 cursor-pointer transform hover:scale-105 border-2 border-[#39ff14]/50 hover:border-[#39ff14] overflow-hidden"
    >
      {/* Card Header with Logo */}
      <div className="h-48 bg-black/50 border-b-2 border-[#39ff14]/50 relative overflow-hidden">
        {imageUrl && !logoError ? (
          <img
            key={`img-${hackathon.id || hackathon._id}-${imageUrl}`} // Force re-render when URL changes
            src={imageUrl}
            alt={hackathon.name}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-300 z-10"
            style={{
              filter: 'grayscale(1) brightness(1.2) sepia(1) hue-rotate(90deg)',
            }}
            onMouseEnter={(e) => {
              e.target.style.filter = 'grayscale(0) sepia(0)';
            }}
            onMouseLeave={(e) => {
              e.target.style.filter = 'grayscale(1) brightness(1.2) sepia(1) hue-rotate(90deg)';
            }}
            onError={(e) => {
              console.error('❌ Image failed to load:', imageUrl, 'for hackathon:', hackathon.name);
              handleImageError();
            }}
            onLoad={(e) => {
              setLogoError(false);
              setShowFallback(false);
            }}
          />
        ) : null}
        
        {(showFallback || !imageUrl || logoError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-0">
            <div className="text-[#39ff14] text-4xl font-bold opacity-50 pixel-text">
              {firstLetter}
            </div>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-5">
        {/* Name */}
        <h3 className="text-lg font-bold text-white mb-3 line-clamp-2 group-hover:text-[#39ff14] transition-colors min-h-[3.5rem] pixel-text code-glow">
          {hackathon.name || 'HACKATHON_EVENT'}
        </h3>

        {/* Location */}
        <div className="mb-3 flex items-start gap-2">
          <span className="text-[#39ff14] mt-0.5 pixel-text">LOCATION:</span>
          <span className="text-sm text-white/80 flex-1 pixel-text">{hackathon.location || 'TBD'}</span>
        </div>

        {/* Dates */}
        <div className="mb-4">
          <p className="text-xs text-[#39ff14] mb-1 font-bold pixel-text">DATES:</p>
          <p className="text-sm font-bold text-white pixel-text">
            {formatDateRange(hackathon.start_date, hackathon.end_date).replace(/\s*\(day:\s*\d+\)/gi, '')}
          </p>
        </div>

        {/* Type Badge */}
        {hackathon.type && (
          <div className="mb-4">
            <span className="inline-flex items-center px-3 py-1 border-2 border-[#39ff14]/50 text-xs font-bold text-[#39ff14] pixel-text">
              {hackathon.type}
            </span>
          </div>
        )}

        {/* Description (if available) */}
        {hackathon.description && (
          <p className="text-xs text-white/60 mb-4 line-clamp-2 pixel-text">
            {hackathon.description}
          </p>
        )}

        {/* Click indicator */}
        <div className="pt-4 border-t-2 border-[#39ff14]/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#39ff14] group-hover:code-glow pixel-text">
              FIND_TEAMMATES()
            </span>
            <span className="text-[#39ff14] group-hover:translate-x-1 transition-transform pixel-text">
              →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HackathonCard;

