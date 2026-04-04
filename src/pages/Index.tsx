import { useState } from 'react';
import { motion } from 'framer-motion';
import { Disc3, TrendingUp, Star, Users } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { SearchBar } from '@/components/search/SearchBar';
import { ArtistCard } from '@/components/music/ArtistCard';
import { AlbumCard } from '@/components/music/AlbumCard';
import { searchArtists, searchReleases, type MusicBrainzArtist, type MusicBrainzRelease } from '@/lib/musicbrainz';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [artists, setArtists] = useState<MusicBrainzArtist[]>([]);
  const [albums, setAlbums] = useState<MusicBrainzRelease[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchType, setSearchType] = useState<'artists' | 'albums'>('artists');

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      if (searchType === 'artists') {
        const results = await searchArtists(query, 12);
        setArtists(results);
        setAlbums([]);
      } else {
        const results = await searchReleases(query, 12);
        setAlbums(results);
        setArtists([]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background glow elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        <div className="container mx-auto max-w-6xl relative">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h1 className="text-6xl md:text-8xl font-boldonse mb-6 tracking-wide">
              <span className="gradient-text">DISCOVER</span>
              <br />
              <span className="text-foreground">&amp; RATE</span>
            </h1>
            
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Explore millions of artists and albums. Rate your favorites and visualize your musical journey.
            </p>
          </motion.div>

          {/* Search Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'artists' | 'albums')} className="w-full max-w-2xl mx-auto mb-8">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
                <TabsTrigger value="artists" className="data-[state=active]:gradient-bg data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs">
                  <Users className="w-4 h-4 mr-2" />
                  Artists
                </TabsTrigger>
                <TabsTrigger value="albums" className="data-[state=active]:gradient-bg data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs">
                  <Disc3 className="w-4 h-4 mr-2" />
                  Albums
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <SearchBar 
              onSearch={handleSearch} 
              isLoading={isSearching}
              placeholder={searchType === 'artists' ? 'Search for artists...' : 'Search for albums...'}
            />
          </motion.div>

          {/* Stats */}
          {!hasSearched && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16"
            >
              {[
                { icon: Users, label: 'Artists', value: '2M+' },
                { icon: Disc3, label: 'Albums', value: '3M+' },
                { icon: Star, label: 'Ratings', value: user ? 'Track yours' : 'Sign in' },
                { icon: TrendingUp, label: 'Insights', value: 'Visualize' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-6 rounded-2xl bg-card/50 border border-border/30 text-center hover:border-primary/30 transition-all duration-300 group"
                >
                  <stat.icon className="w-5 h-5 mx-auto mb-3 text-primary group-hover:scale-110 transition-transform" />
                  <div className="text-xl font-boldonse gradient-text">{stat.value}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Results Section */}
      {hasSearched && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-6xl">
            {isSearching ? (
              <div className="flex items-center justify-center py-20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Disc3 className="w-12 h-12 text-primary" />
                </motion.div>
              </div>
            ) : (
              <>
                {searchType === 'artists' && artists.length > 0 && (() => {
                  const [best, ...others] = artists;
                  return (
                    <>
                      <div className="mb-12">
                        <h2 className="text-2xl font-boldonse mb-6 uppercase tracking-wider">Best Match</h2>
                        <div className="max-w-sm">
                          <ArtistCard key={best.id} artist={best} index={0} />
                        </div>
                      </div>

                      {others.length > 0 && (
                        <div>
                          <h2 className="text-lg font-boldonse mb-6 text-muted-foreground uppercase tracking-wider">Other Results</h2>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {others.map((artist, index) => (
                              <ArtistCard key={artist.id} artist={artist} index={index} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {searchType === 'albums' && albums.length > 0 && (() => {
                  const [best, ...others] = albums;
                  return (
                    <>
                      <div className="mb-12">
                        <h2 className="text-2xl font-boldonse mb-6 uppercase tracking-wider">Best Match</h2>
                        <div className="max-w-[200px]">
                          <AlbumCard
                            key={best.id}
                            album={{
                              id: best['release-group']?.id || best.id,
                              title: best.title,
                              artistName: best['artist-credit']?.[0]?.artist.name,
                              releaseDate: best.date,
                              type: best['release-group']?.['primary-type'],
                            }}
                            index={0}
                          />
                        </div>
                      </div>

                      {others.length > 0 && (
                        <div>
                          <h2 className="text-lg font-boldonse mb-6 text-muted-foreground uppercase tracking-wider">Other Results</h2>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                            {others.map((release, index) => (
                              <AlbumCard
                                key={release.id}
                                album={{
                                  id: release['release-group']?.id || release.id,
                                  title: release.title,
                                  artistName: release['artist-credit']?.[0]?.artist.name,
                                  releaseDate: release.date,
                                  type: release['release-group']?.['primary-type'],
                                }}
                                index={index}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {((searchType === 'artists' && artists.length === 0) ||
                  (searchType === 'albums' && albums.length === 0)) && (
                  <div className="text-center py-20">
                    <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-boldonse mb-2 uppercase">No results found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search query
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default Index;
