import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { toast } from 'sonner';
import { SeatMapGrid, SeatMapSeat } from '../../components/seatmap/SeatMapGrid';

interface Venue {
  id: string;
  name: string;
  address: string;
}

interface Category {
  id: string;
  name: string;
  baseLabel: string;
}

type ViewState = 'LIST' | 'CREATE_VENUE' | 'MANAGE_VENUE';

export function AdminVenues() {
  const [view, setView] = useState<ViewState>('LIST');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeVenue, setActiveVenue] = useState<Venue | null>(null);
  
  // Create/Edit Venue State
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');
  const [isEditingVenue, setIsEditingVenue] = useState(false);
  const [editingVenueName, setEditingVenueName] = useState('');

  // Categories State
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatLabel, setEditCatLabel] = useState('');

  // Layout Builder State
  const [selectedCatId, setSelectedCatId] = useState('');
  const [gridRows, setGridRows] = useState(10);
  const [gridSeatsPerRow, setGridSeatsPerRow] = useState(10);
  const [gridStartX, setGridStartX] = useState(0);
  const [gridStartY, setGridStartY] = useState(0);

  // Preview State
  const [previewSeats, setPreviewSeats] = useState<SeatMapSeat[]>([]);

  // Category Edit Handlers
  const handleUpdateCategory = async (e: React.FormEvent, catId: string) => {
    e.preventDefault();
    if (!activeVenue) return;
    try {
      await api.patch(`/venues/${activeVenue.id}/categories/${catId}`, { name: editCatName, baseLabel: editCatLabel });
      toast.success('Category updated');
      setEditingCatId(null);
      fetchVenueDetails(activeVenue.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!activeVenue) return;
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/venues/${activeVenue.id}/categories/${catId}`);
      toast.success('Category deleted');
      fetchVenueDetails(activeVenue.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const handleUpdateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVenue) return;
    try {
      const updated = await api.patch<Venue>(`/venues/${activeVenue.id}`, { name: editingVenueName });
      toast.success('Venue updated');
      setActiveVenue(updated);
      setIsEditingVenue(false);
      fetchVenues();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update venue');
    }
  };
  
  const fetchVenues = useCallback(async () => {
    setIsLoading(true);
    try {
      // Assuming GET /venues returns { data: Venue[] } or { data: { venues: Venue[] } }
      // According to typical pagination it might be { data: { venues, total } } or just an array
      const res = await api.get<{ venues: Venue[] }>('/venues');
      setVenues(res.venues || (res as any) || []);
    } catch (error) {
      toast.error('Failed to load venues');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'LIST') {
      fetchVenues();
    }
  }, [view, fetchVenues]);

  const fetchVenueDetails = useCallback(async (venueId: string) => {
    try {
      const cats = await api.get<Category[]>(`/venues/${venueId}/categories`);
      setCategories(cats);
      if (cats.length > 0) setSelectedCatId(cats[0].id);

      const seats = await api.get<SeatMapSeat[]>(`/venues/${venueId}/seats`);
      setPreviewSeats(seats);
    } catch (error) {
      toast.error('Failed to load venue details');
    }
  }, []);

  const handleManageVenue = (venue: Venue) => {
    setActiveVenue(venue);
    setView('MANAGE_VENUE');
    fetchVenueDetails(venue.id);
  };

  // Form Errors State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleApiError = (error: any) => {
    if (error.details) {
      const errors: Record<string, string> = {};
      Object.entries(error.details).forEach(([key, messages]) => {
        const field = key.replace('body.', '');
        errors[field] = Array.isArray(messages) ? messages[0] : (messages as string);
      });
      setFormErrors(errors);
    } else {
      toast.error(error.message || 'Action failed');
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    try {
      const created = await api.post<Venue>('/venues', { name: newVenueName, address: newVenueAddress });
      toast.success('Venue created!');
      setNewVenueName('');
      setNewVenueAddress('');
      handleManageVenue(created);
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVenue) return;
    setFormErrors({});
    try {
      await api.post(`/venues/${activeVenue.id}/categories`, { name: newCatName, baseLabel: newCatLabel });
      toast.success('Category added');
      setNewCatName('');
      setNewCatLabel('');
      fetchVenueDetails(activeVenue.id);
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const handleGenerateGrid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVenue || !selectedCatId) return;
    setFormErrors({});
    try {
      await api.post(`/venues/${activeVenue.id}/seats/grid`, {
        categoryId: selectedCatId,
        rows: gridRows,
        seatsPerRow: gridSeatsPerRow,
        startX: gridStartX,
        startY: gridStartY,
        xSpacing: 1,
        ySpacing: 1,
      });
      toast.success('Grid layout generated successfully!');
      fetchVenueDetails(activeVenue.id);
    } catch (error: any) {
      handleApiError(error);
    }
  };

  if (view === 'LIST') {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-text-primary">Venue Management</h1>
            <p className="text-text-muted mt-1">Create and manage venues and seat layouts</p>
          </div>
          <button onClick={() => setView('CREATE_VENUE')} className="btn-primary">
            Create Venue
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-accent-marquee border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {venues.map(v => (
              <div key={v.id} className="card p-6 flex justify-between items-center hover:border-accent-marquee/50 transition-colors cursor-pointer" onClick={() => handleManageVenue(v)}>
                <div>
                  <h3 className="text-xl font-bold text-text-primary">{v.name}</h3>
                  <p className="text-text-muted mt-1">{v.address}</p>
                </div>
                <button className="btn-secondary">Manage Layout</button>
              </div>
            ))}
            {venues.length === 0 && (
              <div className="card text-center p-12">
                <p className="text-text-muted mb-4">No venues found</p>
                <button onClick={() => setView('CREATE_VENUE')} className="btn-primary">Create your first venue</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (view === 'CREATE_VENUE') {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-8">
        <div className="mb-8 flex items-center gap-4">
          <button onClick={() => setView('LIST')} className="p-2 hover:bg-surface rounded-full transition-colors text-text-muted">
            ← Back
          </button>
          <h1 className="font-display text-3xl font-bold text-text-primary">Create Venue</h1>
        </div>

        <form onSubmit={handleCreateVenue} className="card p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Venue Name</label>
            <input 
              type="text" 
              value={newVenueName}
              onChange={e => setNewVenueName(e.target.value)}
              className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-3 focus:outline-none focus:border-accent-marquee"
              placeholder="e.g., Grand Theater"
            />
            {formErrors.name && <p className="text-state-error text-xs mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Address</label>
            <textarea 
              value={newVenueAddress}
              onChange={e => setNewVenueAddress(e.target.value)}
              className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-3 focus:outline-none focus:border-accent-marquee"
              placeholder="e.g., 123 Main St, City"
              rows={3}
            />
            {formErrors.address && <p className="text-state-error text-xs mt-1">{formErrors.address}</p>}
          </div>
          <button type="submit" className="btn-primary w-full">Create Venue & Continue</button>
        </form>
      </div>
    );
  }

  if (view === 'MANAGE_VENUE' && activeVenue) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => {
              setView('LIST');
              setIsEditingVenue(false);
            }} className="p-2 hover:bg-surface rounded-full transition-colors text-text-muted">
              ← Back
            </button>
            
            {isEditingVenue ? (
              <form onSubmit={handleUpdateVenue} className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={editingVenueName} 
                  onChange={e => setEditingVenueName(e.target.value)} 
                  className="bg-surface border border-surface-highlight text-text-primary rounded px-3 py-1 text-xl font-display font-bold focus:outline-none focus:border-accent-marquee"
                />
                <button type="submit" className="text-accent-marquee hover:underline text-sm font-medium">Save</button>
                <button type="button" onClick={() => setIsEditingVenue(false)} className="text-text-muted hover:text-text-primary text-sm">Cancel</button>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="font-display text-3xl font-bold text-text-primary">{activeVenue.name}</h1>
                  <p className="text-text-muted mt-1">Layout Builder & Categories</p>
                </div>
                <button onClick={() => {
                  setEditingVenueName(activeVenue.name);
                  setIsEditingVenue(true);
                }} className="text-text-muted hover:text-accent-marquee text-sm ml-2">Edit Name</button>
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Left Column: Forms */}
          <div className="space-y-8">
            
            {/* Category Manager */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-text-primary mb-6">Seat Categories</h2>
              
              <div className="space-y-3 mb-6">
                {categories.length === 0 ? (
                  <p className="text-sm text-text-muted">No categories added yet.</p>
                ) : (
                  categories.map(c => (
                    <div key={c.id} className="flex flex-col gap-2 p-3 bg-bg-night rounded-2xl border border-surface/50">
                      {editingCatId === c.id ? (
                        <form onSubmit={(e) => handleUpdateCategory(e, c.id)} className="flex items-center gap-2">
                          <input type="text" value={editCatName} onChange={e => setEditCatName(e.target.value)} className="w-1/2 bg-surface border border-surface-highlight text-text-primary rounded px-2 py-1 text-sm" placeholder="Name" required />
                          <input type="text" value={editCatLabel} onChange={e => setEditCatLabel(e.target.value)} className="w-1/3 bg-surface border border-surface-highlight text-text-primary rounded px-2 py-1 text-sm font-mono" placeholder="Prefix" required />
                          <div className="flex flex-col gap-1">
                            <button type="submit" className="text-accent-marquee text-xs hover:underline">Save</button>
                            <button type="button" onClick={() => setEditingCatId(null)} className="text-text-muted text-xs hover:underline">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary">{c.name}</span>
                            <span className="font-mono text-xs text-text-muted px-2 py-1 bg-surface rounded">Prefix: {c.baseLabel}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <button onClick={() => {
                              setEditingCatId(c.id);
                              setEditCatName(c.name);
                              setEditCatLabel(c.baseLabel);
                            }} className="text-text-muted hover:text-accent-marquee">Edit</button>
                            <button onClick={() => handleDeleteCategory(c.id)} className="text-state-error hover:underline">Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Name</label>
                    <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="VIP" className="w-full bg-surface border border-surface-highlight text-text-primary rounded p-2 text-sm" />
                    {formErrors.name && <p className="text-state-error text-xs mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Row Prefix</label>
                    <input type="text" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="V" className="w-full bg-surface border border-surface-highlight text-text-primary rounded p-2 text-sm" />
                    {formErrors.baseLabel && <p className="text-state-error text-xs mt-1">{formErrors.baseLabel}</p>}
                  </div>
                </div>
                <button type="submit" className="btn-secondary w-full text-sm">Add Category</button>
              </form>
            </div>

            {/* Layout Builder */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-text-primary mb-6">Generate Grid Layout</h2>
              <form onSubmit={handleGenerateGrid} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Target Category</label>
                  <select 
                    required 
                    value={selectedCatId} 
                    onChange={e => setSelectedCatId(e.target.value)} 
                    className="w-full bg-surface border border-surface-highlight text-text-primary rounded p-2 text-sm"
                    disabled={categories.length === 0}
                  >
                    <option value="" disabled>Select category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Number of Rows</label>
                    <input type="number" min="1" required value={gridRows} onChange={e => setGridRows(parseInt(e.target.value))} className="w-full bg-surface border border-surface-highlight text-text-primary rounded p-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Seats per Row</label>
                    <input type="number" min="1" required value={gridSeatsPerRow} onChange={e => setGridSeatsPerRow(parseInt(e.target.value))} className="w-full bg-surface border border-surface-highlight text-text-primary rounded p-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-surface/50">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Start Offset X</label>
                    <input type="number" min="0" required value={gridStartX} onChange={e => setGridStartX(parseInt(e.target.value))} className="w-full bg-surface border border-surface-highlight text-text-primary rounded p-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Start Offset Y</label>
                    <input type="number" min="0" required value={gridStartY} onChange={e => setGridStartY(parseInt(e.target.value))} className="w-full bg-surface border border-surface-highlight text-text-primary rounded p-2 text-sm" />
                  </div>
                </div>

                <button type="submit" disabled={categories.length === 0} className="btn-primary w-full text-sm mt-4">
                  Generate Seats
                </button>
              </form>
            </div>
            
          </div>

          {/* Right Column: Live Preview */}
          <div className="lg:col-span-2">
            <div className="card p-6 h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-text-primary">Live Preview</h2>
                <span className="text-xs text-text-muted font-mono">{previewSeats.length} Total Seats</span>
              </div>
              
              <div className="flex-1 bg-bg-night rounded-2xl border border-surface overflow-hidden relative min-h-[500px]">
                {previewSeats.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-text-muted">
                    <p>No seats generated yet. Add a category and generate a grid!</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 overflow-auto">
                    {/* Reusing SeatMapGrid in a non-interactive mode. 
                        We map the seats so they have a dummy 'status' of 'AVAILABLE' 
                        so they render properly in the visual component. */}
                    <SeatMapGrid
                      seats={previewSeats.map((s: any) => ({ 
                        ...s, 
                        categoryName: s.category.name,
                        categoryBaseLabel: s.category.baseLabel,
                        status: 'AVAILABLE', 
                        holdExpiresAt: null, 
                        heldByUserId: null, 
                        price: 0 
                      }))}
                      selectedSeatIds={[]}
                      onToggleSeat={() => {}}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}