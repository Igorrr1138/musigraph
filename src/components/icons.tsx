/**
 * Phosphor icon set for the whole app.
 *
 * Icons are monoline/geometric per the editorial design system. Every icon is
 * re-exported under a stable name so call sites stay framework-agnostic.
 */
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsDownUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CalendarBlank,
  ChartLine,
  Check,
  Circle,
  CircleNotch,
  Clock,
  Cpu,
  Diamond,
  DotsSixVertical,
  DotsThree,
  Download,

  FadersHorizontal,
  Fire,
  FloppyDisk,
  Gear,
  Guitar,
  Headphones,
  Image as PhImage,
  ImageBroken,
  Info,
  Lock,
  MagnifyingGlass,
  MapPin,
  Microphone,
  MicrophoneSlash,
  MusicNote,
  MusicNotes,
  MusicNotesSimple,
  Pause,
  PencilSimple,
  PianoKeys,
  Play,
  PlayCircle,
  Playlist,
  Plus,
  RadioButton,
  Repeat,
  RepeatOnce,
  ShieldCheck,
  ShuffleSimple,
  SidebarSimple,
  SignOut,
  SkipBack,
  SkipForward,
  Sparkle,
  SpeakerSimpleHigh,
  SpeakerSimpleLow,
  SpeakerSimpleX,
  Star,
  StarHalf,
  Tag,
  Trash,
  TrendUp,
  User,
  Users,
  VinylRecord,
  House,
  Envelope,
  X,
  Pulse,
} from '@phosphor-icons/react';

export type { Icon as IconComponent } from '@phosphor-icons/react';

export {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Circle,
  Clock,
  Cpu,
  Diamond,
  Download,

  Headphones,
  House,
  Info,
  Lock,
  MapPin,
  Pause,
  Play,
  PlayCircle,
  Playlist,
  Plus,
  Repeat,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Star,
  StarHalf,
  Tag,
  User,
  Users,
  X,
  Gear,
  ChartLine,
  FadersHorizontal,
  MagnifyingGlass,
  MicrophoneSlash,
  SpeakerSimpleHigh,
  SignOut,
  ArrowsDownUp,
};

/* Aliases keeping previous call-site names working with Phosphor glyphs */
export const Activity = Pulse;
export const BarChart3 = ChartLine;
export const Calendar = CalendarBlank;
export const CalendarDays = CalendarBlank;
export const ChevronDown = CaretDown;
export const ChevronLeft = CaretLeft;
export const ChevronRight = CaretRight;
export const ChevronUp = CaretUp;
export const Disc3 = VinylRecord;
export const Dot = Circle;
export const Flame = Fire;
export const GripVertical = DotsSixVertical;

export const Image = PhImage;
export const ImageIcon = PhImage;
export const ImageOff = ImageBroken;
export const ListMusic = Playlist;
export const Loader2 = CircleNotch;
export const LogOut = SignOut;
export const Mail = Envelope;
export const Mic = Microphone;
export const Mic2 = Microphone;
export const MicOff = MicrophoneSlash;
export const MoreHorizontal = DotsThree;
export const Music = MusicNote;
export const Music2 = MusicNotes;
export const PanelLeft = SidebarSimple;
export const Pencil = PencilSimple;
export const Piano = PianoKeys;
export const Radio = RadioButton;
export const RefreshCw = ArrowClockwise;
export const Repeat1 = RepeatOnce;
export const RotateCcw = ArrowCounterClockwise;
export const Save = FloppyDisk;
export const Search = MagnifyingGlass;
export const Settings2 = FadersHorizontal;
export const Shuffle = ShuffleSimple;
export const Sparkles = Sparkle;
export const Trash2 = Trash;
export const TrendingUp = TrendUp;
export const Volume1 = SpeakerSimpleLow;
export const Volume2 = SpeakerSimpleHigh;
export const VolumeX = SpeakerSimpleX;
export const MusicSimple = MusicNotesSimple;

export const Drum = MusicNotesSimple;
export { Guitar, PianoKeys };
