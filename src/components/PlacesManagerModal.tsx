import React, { useState } from 'react';
import { MapPin, Plus, Trash2, Home, Briefcase, GraduationCap, Dumbbell, Users, X, Compass } from 'lucide-react';
import { SavedPlace } from '../types';

interface PlacesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: SavedPlace[];
  onAddPlace: (place: Partial<SavedPlace>) => void;
  onDeletePlace: (placeId: string) => void;
  initialLat?: number;
  initialLng?: number;
}

export const PlacesManagerModal: React.FC<PlacesManagerModalProps> = ({
  isOpen,
  onClose,
  places,
  onAddPlace,
  onDeletePlace,
  initialLat = 37.7749,
  initialLng = -122.4194,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'home' | 'school' | 'work' | 'gym' | 'family' | 'other'>('home');
  const [lat, setLat] = useState(initialLat.toFixed(5));
  const [lng, setLng] = useState(initialLng.toFixed(5));
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [address, setAddress] = useState('');
  const [color, setColor] = useState('#10b981');

  if (!isOpen) return null;

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddPlace({
      name: name.trim(),
      category,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radiusMeters,
      address: address.trim() || `${lat}, ${lng}`,
      color,
    });

    setName('');
    setAddress('');
    setIsAdding(false);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'home':
        return <Home className="w-4 h-4 text-emerald-400" />;
      case 'work':
        return <Briefcase className="w-4 h-4 text-blue-400" />;
      case 'school':
        return <GraduationCap className="w-4 h-4 text-amber-400" />;
      case 'gym':
        return <Dumbbell className="w-4 h-4 text-purple-400" />;
      default:
        return <MapPin className="w-4 h-4 text-rose-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-slate-100 ring-1 ring-white/10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Geofenced Saved Places</h3>
              <p className="text-xs text-slate-400">Real-time arrival &amp; departure alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto my-4 space-y-3">
          {isAdding ? (
            <form onSubmit={handleSubmitNew} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <h4 className="font-semibold text-sm text-white">Create New Geofenced Place</h4>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Place Name</label>
                <input
                  type="text"
                  placeholder="e.g., Mom's Office, Grandma House..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const cat = e.target.value as any;
                      setCategory(cat);
                      if (cat === 'home') setColor('#10b981');
                      if (cat === 'work') setColor('#3b82f6');
                      if (cat === 'school') setColor('#f59e0b');
                      if (cat === 'gym') setColor('#8b5cf6');
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="home">Home</option>
                    <option value="school">School</option>
                    <option value="work">Work</option>
                    <option value="gym">Gym / Sports</option>
                    <option value="family">Family / Relatives</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Radius (Meters)</label>
                  <select
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={80}>80 meters (Small house)</option>
                    <option value={150}>150 meters (Standard)</option>
                    <option value={300}>300 meters (Large campus)</option>
                    <option value={600}>600 meters (Neighborhood)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g., 123 Main St, Springfield"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow"
                >
                  Save Place
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              Add New Saved Place
            </button>
          )}

          {/* List of existing places */}
          <div className="space-y-2 pt-2">
            {places.length === 0 && !isAdding ? (
              <div className="text-center py-8 px-4 bg-slate-950/40 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-300">No saved places yet</p>
                <p className="text-[11px] leading-relaxed">
                  Add your Home, School, or Work to receive automated arrival and departure alerts.
                </p>
              </div>
            ) : (
              places.map((place) => (
              <div
                key={place.id}
                className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3 hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${place.color}20` }}
                  >
                    {getCategoryIcon(place.category)}
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-white flex items-center gap-2">
                      <span>{place.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({place.radiusMeters}m radius)
                      </span>
                    </h5>
                    <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                      {place.address}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onDeletePlace(place.id)}
                  className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                  title="Delete Place"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
};
