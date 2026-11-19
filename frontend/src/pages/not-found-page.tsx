import { t as tr, useLocale } from "../i18n";
import { Trans } from "react-i18next";
import { ArrowLeft } from 'lucide-react';
import { LinkButton } from '../components/ui';
export function NotFoundPage() {
  useLocale(); return <section className="not-found site-container"><span className="not-found-number">404</span><p className="eyebrow">{tr("common:notFoundPage.aDifferentPath")}</p><h1><Trans ns="common" i18nKey="notFoundPage.youMayHaveWanderedALittleFar" components={{ part0: <br />, part1: <em /> }} /></h1><p><Trans ns="common" i18nKey="notFoundPage.thePageYouAreLookingForDoesNotExistOrHasMoved" components={{ part0: <br /> }} /></p><LinkButton to="/"><ArrowLeft size={18} />{tr("common:authPages.backToHome")}</LinkButton></section>; }
