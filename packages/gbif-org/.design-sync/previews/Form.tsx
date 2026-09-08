import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from 'new-gbif-org-ts';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

// Modeled on the "Suggest a dataset" form (src/routes/resource/key/composition/blocks/
// customComponents/suggestDatasetForm.tsx): `useForm()` from react-hook-form, wired through
// `<Form {...form}>` (react-hook-form's own FormProvider) into `FormField`/`FormItem`/
// `FormLabel`/`FormControl`/`FormMessage`. react-hook-form is a real app dependency (not
// context-fragile like react-intl) — `useForm`'s return value is plain data/closures consumed
// by the bundle's own Controller/useFormContext, so a second copy in the preview file does not
// create a duplicate-context problem the way `<FormattedMessage>` would.
type Inputs = {
  title: string;
  taxon: string;
};

export const SuggestDatasetFields = () => {
  const form = useForm<Inputs>({
    defaultValues: { title: 'Odonata of the Danube Delta', taxon: 'Odonata' },
  });

  return (
    <Form {...form}>
      <form className="g-flex g-flex-col g-gap-4 g-max-w-sm">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dataset title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Odonata of the Danube Delta" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="taxon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Taxonomic scope</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Odonata" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" className="g-w-fit">
          Submit suggestion
        </Button>
      </form>
    </Form>
  );
};

// A field with a validation error, so `FormMessage`'s destructive styling is visible. The
// installed react-hook-form (7.48) has no top-level `errors` option on `useForm` — that's a
// later addition — so the error is set imperatively via `form.setError`, same effect a failed
// submit or resolver would produce.
type LoginInputs = { email: string };

export const FieldWithError = () => {
  const form = useForm<LoginInputs>({ defaultValues: { email: '' } });

  useEffect(() => {
    form.setError('email', {
      type: 'required',
      message: 'Please enter a contact email address.',
    });
  }, [form]);

  return (
    <Form {...form}>
      <form className="g-max-w-sm">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel highlightError>Contact email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.org" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
