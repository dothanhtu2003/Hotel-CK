import { useEffect } from 'react';
import { useForm as useHookForm, type FieldValues, type UseFormProps } from 'react-hook-form';
import { useLocale } from './index';

/** Refresh only existing validation errors; retain values, dirty state and component identity. */
export function useForm<T extends FieldValues>(options: UseFormProps<T>) {
  const form = useHookForm<T>(options);
  const locale = useLocale();
  useEffect(() => {
    if (Object.keys(form.formState.errors).length) void form.trigger();
    // Validation must refresh on language changes, not on each keystroke/error update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  return form;
}
