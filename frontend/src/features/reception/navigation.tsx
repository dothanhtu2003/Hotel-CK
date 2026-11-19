import { t as tr, useLocale } from "../../i18n";
import { useDeskOrigin } from './navigation-state';
import { Link, useLocation, useNavigate, type LinkProps } from 'react-router';
import { LinkButton } from '../../components/ui';
import type { ComponentProps } from 'react';

export function DeskLink(props: LinkProps) {
  useLocale();
  const origin = useDeskOrigin();
  return <Link {...props} state={origin} />;
}

export function DeskLinkButton(props: ComponentProps<typeof LinkButton>) {
  useLocale();
  const origin = useDeskOrigin();
  return <LinkButton {...props} state={origin} />;
}

export function DeskBackLink({ to, children, ...props }: Pick<LinkProps, 'className' | 'children'> & { to: string }) {
  useLocale();
  const { state } = useLocation();
  const navigate = useNavigate();
  const origin = state?.deskOrigin;
  if (typeof origin !== 'string' || !origin.startsWith('/') || origin.startsWith('//')) {
    return <Link {...props} to={to}>{children}</Link>;
  }

  return (
    <Link {...props} to={origin} onClick={(event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      void navigate(-1);
    }}>
      <span aria-hidden="true">← </span>{tr("reception:components.back")}</Link>
  );
}
