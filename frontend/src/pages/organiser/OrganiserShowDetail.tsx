import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ShowSummary {
  show: {
    id: string;
    date: string;
    time: string;
    event: {
      title: string;
      venueId: string;
      venue: { name: string; address: string };
    };
  };
  stats: {
    totalSeats: number;
    available: number;
    held: number;
    booked: number;
    revenue: number;
  };
  categoryStats: Array<{
    categoryName: string;
    bookings: number;
    revenue: number;
  }>;
}

interface Category {
  id: string;
  name: string;
  baseLabel: string;
}

export function OrganiserShowDetail() {
  const { showId } = useParams<{ showId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState<ShowSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pricing, setPricing] = useState<Record<string, string>>({}); // string to handle empty inputs cleanly

  useEffect(() => {
    async function fetchData() {
      try {
        const sumRes = await api.get<ShowSummary>(`/shows/${showId}/summary`);
        setSummary(sumRes);

        const [catRes, seatmapRes] = await Promise.all([
          api.get<Category[]>(`/venues/${sumRes.show.event.venueId}/categories`),
          api.get<{ pricing: { categoryId: string; price: number }[] }>(`/shows/${showId}/seatmap`),
        ]);

        setCategories(catRes);

        // Pre-fill existing pricing
        const priceMap: Record<string, string> = {};
        catRes.forEach(c => {
          const existing = seatmapRes.pricing.find(p => p.categoryId === c.id);
          priceMap[c.id] = existing ? (existing.price / 100).toString() : '';
        });
        setPricing(priceMap);
      } catch (error) {
        toast.error('Failed to load show details');
      } finally {
        setIsLoading(false);
      }
    }
    if (showId) fetchData();
  }, [showId]);

  const handlePriceChange = (catId: string, value: string) => {
    // allow empty or numbers
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setPricing(prev => ({ ...prev, [catId]: value }));
    }
  };

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleApiError = (error: any) => {
    if (error.details) {
      const errors: Record<string, string> = {};
      Object.entries(error.details).forEach(([key, messages]) => {
        // key might be "body.pricing.0.price", we'll just show a generic error or try to map it
        errors['global'] = Array.isArray(messages) ? messages[0] : (messages as string);
      });
      setFormErrors(errors);
      toast.error('Please fix the errors before saving');
    } else {
      toast.error(error.message || 'Action failed');
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setIsSaving(true);
    
    // Filter out empty ones and format for API
    const bulkData = categories
      .filter(c => pricing[c.id] !== '')
      .map(c => ({
        categoryId: c.id,
        price: Math.round(parseFloat(pricing[c.id]) * 100), // convert to cents
      }));

    try {
      await api.post(`/shows/${showId}/pricing/bulk`, { pricing: bulkData });
      toast.success('Pricing updated successfully!');
      
      // Refresh summary to reflect potential new revenue expectations (if we update the API later)
      const sumRes = await api.get<ShowSummary>(`/shows/${showId}/summary`);
      setSummary(sumRes);
    } catch (error: any) {
      handleApiError(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-accent-marquee border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center card mt-8">
        <h1 className="text-2xl font-bold mb-4">Show Not Found</h1>
        <Link to="/organiser/events" className="btn-primary">Back to Events</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <Link to="/organiser/events" className="p-2 hover:bg-surface rounded-full transition-colors text-text-muted">
            ← Back
          </Link>
          <h1 className="font-display text-3xl font-bold text-text-primary">{summary.show.event.title}</h1>
        </div>
        <p className="text-text-muted pl-12">
          {new Date(summary.show.date).toLocaleDateString()} at {summary.show.time} • {summary.show.event.venue.name}
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-6 border-l-4 border-accent-marquee/50">
          <h3 className="text-xs font-mono text-text-muted uppercase mb-2">Total Revenue</h3>
          <p className="text-3xl font-bold text-text-primary">
            ${(summary.stats.revenue / 100).toFixed(2)}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-xs font-mono text-text-muted uppercase mb-2">Booked Seats</h3>
          <p className="text-3xl font-bold text-text-primary">
            {summary.stats.booked} <span className="text-lg text-text-muted font-normal">/ {summary.stats.totalSeats}</span>
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-xs font-mono text-text-muted uppercase mb-2">Held Seats</h3>
          <p className="text-3xl font-bold text-text-primary">{summary.stats.held}</p>
        </div>
        <div className="card p-6">
          <h3 className="text-xs font-mono text-text-muted uppercase mb-2">Available</h3>
          <p className="text-3xl font-bold text-text-primary text-state-available">{summary.stats.available}</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Col: Analytics Chart */}
        <div className="lg:col-span-2 space-y-8">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-text-primary mb-6">Revenue by Category</h2>
            {summary.categoryStats.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-text-muted text-sm border border-dashed border-surface rounded-2xl">
                No bookings yet to display data.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.categoryStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <XAxis 
                      dataKey="categoryName" 
                      stroke="#6B7280" // text-muted equivalent
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="#6B7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `$${val/100}`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#E7E5F0' }} // bg-surface approx
                      contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E7E5F0', borderRadius: '16px' }} // bg-night & surface
                      itemStyle={{ color: '#111827' }}
                      formatter={(val: number) => [`$${(val/100).toFixed(2)}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {summary.categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#7C3AED' : '#FF6B4A'} /> // accent-marquee shades
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          
          <div className="card p-6">
             <h2 className="text-lg font-bold text-text-primary mb-6">Bookings by Category</h2>
             {summary.categoryStats.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-text-muted text-sm border border-dashed border-surface rounded-2xl">
                No bookings yet to display data.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.categoryStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <XAxis 
                      dataKey="categoryName" 
                      stroke="#6B7280" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="#6B7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      cursor={{ fill: '#E7E5F0' }}
                      contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E7E5F0', borderRadius: '16px' }}
                      itemStyle={{ color: '#111827' }}
                      formatter={(val: number) => [val, 'Bookings']}
                    />
                    <Bar dataKey="bookings" radius={[4, 4, 0, 0]}>
                      {summary.categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#22C55E" /> // state-available color approx
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Pricing Manager */}
        <div>
          <form onSubmit={handleSavePricing} className="card p-6 sticky top-4 md:top-8">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-text-primary">Seat Pricing</h2>
              <p className="text-xs text-text-muted mt-1">Set the price per ticket for each category.</p>
              {formErrors.global && (
                <p className="text-state-error text-xs mt-2 bg-state-error/10 p-2 rounded">{formErrors.global}</p>
              )}
            </div>
            
            <div className="space-y-4 mb-8">
              {categories.length === 0 ? (
                <p className="text-sm text-text-muted italic">No categories found for this venue.</p>
              ) : (
                categories.map(cat => (
                  <div key={cat.id}>
                    <label className="block text-xs font-mono text-text-muted mb-1 uppercase tracking-wider">
                      {cat.name}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-text-muted">$</span>
                      </div>
                      <input 
                        type="text" 
                        required
                        placeholder="0.00"
                        value={pricing[cat.id] || ''}
                        onChange={(e) => handlePriceChange(cat.id, e.target.value)}
                        className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl pl-8 pr-4 py-3 focus:outline-none focus:border-accent-marquee transition-colors"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSaving || categories.length === 0}
              className="btn-primary w-full py-3"
            >
              {isSaving ? 'Saving...' : 'Save Pricing'}
            </button>
          </form>
        </div>
        
      </div>
    </div>
  );
}