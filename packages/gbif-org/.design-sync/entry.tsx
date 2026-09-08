/**
 * Design-system barrel for /design-sync.
 *
 * gbif-org is an application, not a published component library, so there is no
 * `dist/` entry to bundle. This file is that entry: it re-exports exactly the
 * curated design-system surface, so the bundle stays free of routes, GraphQL
 * documents, server code and map engines.
 *
 * Re-exports are explicit (never `export *`) because several modules export the
 * same name — `largeCard`/`smallCard` both export `Card`, `ui/tabs` and
 * `components/tabs` both export `Tabs`, `ui/separator` and `dataHeader` both
 * export `Separator`, and `classification`/`highlights` both export
 * `TaxonClassification`. Explicit lists make each winner a recorded decision.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Preview / design provider
// ─────────────────────────────────────────────────────────────────────────────
export { GbifPreviewProvider } from './provider';

// ─────────────────────────────────────────────────────────────────────────────
// Primitives — src/components/ui
// ─────────────────────────────────────────────────────────────────────────────
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
export { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
export { Button, buttonVariants } from '@/components/ui/button';
export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
export { Checkbox } from '@/components/ui/checkbox';
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
export {
  Dialog,
  DialogBottomSheetContent,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdownMenu';
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
// `largeCard` is the canonical Card (108 importers vs smallCard's 64).
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DiscreteCardTitle,
} from '@/components/ui/largeCard';
export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
export { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export { Progress } from '@/components/ui/progress';
export { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export { Separator } from '@/components/ui/separator';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
export { Skeleton, SkeletonParagraph, SkeletonTable } from '@/components/ui/skeleton';
export { Spinner } from '@/components/ui/spinner';
export { Switch } from '@/components/ui/switch';
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
export { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
export { Textarea } from '@/components/ui/textarea';
export {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
export { Toaster } from '@/components/ui/toaster';
export { Toggle, toggleVariants } from '@/components/ui/toggle';
export { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─────────────────────────────────────────────────────────────────────────────
// GBIF composed components — src/components
// ─────────────────────────────────────────────────────────────────────────────
export { Callout } from '@/components/callout';
export {
  Classification,
  GadmClassification,
  GeologicalLayers,
  TaxonClassification,
  TaxonStubClassification,
} from '@/components/classification';
// `Separator` here collides with ui/separator — DataHeader only.
export { DataHeader } from '@/components/dataHeader';
export { default as EmptyTab } from '@/components/EmptyTab';
export { default as EmptyValue } from '@/components/emptyValue';
export { ErrorMessage } from '@/components/errorMessage';
export { FilterButtonGroup } from '@/components/filterButtonGroup';
// FilterButton is deliberately NOT exported: it imports getFilterSummary from
// filters/filterTools.tsx, which imports every filter type including
// geometryFilter -> ol + proj4 (~2.3 MB). See .design-sync/NOTES.md.
export { FilterPopover } from '@/components/filters/filterPopover';
export {
  DeletedMessage,
  HeaderInfo,
  HeaderInfoEdit,
  HeaderInfoMain,
  Hostname,
} from '@/components/headerComponents';
// `TaxonClassification` / `GadmClassification` come from classification.tsx above.
export {
  Coordinates,
  FeatureList,
  GenericFeature,
  GenericFeatureSkeleton,
  GeologicalContext,
  Homepage,
  IIIF,
  Location,
  SamplingEvent,
  Sequenced,
  TypeStatus,
} from '@/components/highlights';
export { BooleanValue, HyperText } from '@/components/hyperText';
export {
  DoiTag,
  IdentifierTag,
  IdentifierType,
  IdentifierValue,
  IucnTag,
  LicenceTag,
  Lsid,
  OrcId,
} from '@/components/identifierTag';
export { Img } from '@/components/Img';
export { LoadingIndicator } from '@/components/loadingIndicator';
export { FormattedDateRange, Message, Unknown } from '@/components/message';
export { NoRecords } from '@/components/noDataMessages';
export { PaginationFooter } from '@/components/pagination';
export { Paging } from '@/components/paging';
export {
  default as Properties,
  AutomaticPropertyValue,
  Property,
  PropertyLabel,
  Term,
  Value,
} from '@/components/properties';
// resultCards/index.tsx exports only the `ResultCard` namespace object; the
// parts live in their own modules and must be imported from there.
export { ResultCard } from '@/components/resultCards';
export { ResultCardContainer } from '@/components/resultCards/resultCardContainer';
export { ResultCardContent } from '@/components/resultCards/resultCardContent';
export { ResultCardHeader, ResultCardHeaderBasic } from '@/components/resultCards/resultCardHeader';
export { ResultCardImage } from '@/components/resultCards/resultCardImage';
export { ResultCardMetadata } from '@/components/resultCards/resultCardMetadata';
export { ResultCardTag } from '@/components/resultCards/resultCardTag';
export { SearchInput } from '@/components/searchInput';
export { SimpleTooltip } from '@/components/simpleTooltip';
export { CardListSkeleton } from '@/components/skeletonLoaders';
export { default as StripeLoader } from '@/components/stripeLoader';
export { TableOfContents } from '@/components/tableOfContents';
export { TabLink } from '@/components/tabLink';
export { default as TestSiteAlert } from '@/components/TestSiteAlert';
export { TimeAgo } from '@/components/timeAgo';
export { ViewHeader } from '@/components/ViewHeader';
