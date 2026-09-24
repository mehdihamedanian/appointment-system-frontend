"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchInput } from "@/components/ui/search-input";
import { Checkbox, Radio, RadioGroup, Switch } from "@/components/ui/selection";
import { MultiSelect, Select } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { DatePicker, TimePicker } from "@/components/ui/date-time";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Accordion } from "@/components/ui/accordion";
import { Pagination } from "@/components/ui/pagination";
import { Stepper } from "@/components/ui/stepper";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge, Avatar, Card, StatCard, Timeline } from "@/components/ui/data-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileUpload, type UploadItem } from "@/components/ui/file-upload";
import { Modal } from "@/components/feedback/modal";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  EmptyState,
  NoResultsState,
  ApiErrorState,
  SuccessState,
  PermissionDeniedState,
  SessionExpiredState,
  FeatureDisabledState,
  BackendDependencyState,
  ConflictState,
} from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { Drawer } from "@/components/ui/drawer";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { PageHeader, Breadcrumb } from "@/components/layout/page-header";
import { Container, Divider, Grid, Inline, Stack } from "@/components/layout/primitives";
import { Bell } from "lucide-react";
import { toast } from "@/components/feedback/toast";

const serviceOptions = [
  { value: "a", label: "مشاوره اولیه" },
  { value: "b", label: "خدمات تخصصی طولانی‌مدت" },
  { value: "c", label: "پیکره‌بندی دستگاه", disabled: true },
];

function Section({
  title,
  purpose,
  children,
}: {
  title: string;
  purpose: string;
  children: ReactNode;
}) {
  return (
    <section className="ds-card">
      <h2 className="text-section-title">{title}</h2>
      <p className="ds-help">{purpose}</p>
      {children}
    </section>
  );
}

export function DesignSystemCatalog() {
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [selectValue, setSelectValue] = useState<string | undefined>("a");
  const [multi, setMulti] = useState<string[]>(["a"]);
  const [date, setDate] = useState<string | undefined>("2026-08-21");
  const [time, setTime] = useState("09:00");
  const [page, setPage] = useState(2);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [radio, setRadio] = useState("one");

  return (
    <Container size="xl">
      <Stack gap={8}>
        <PageHeader
          title="کاتالوگ سامانه طراحی"
          description="نمایش حالت‌ها و اجزای عمومی. این صفحه در محیط تولید در دسترس نیست."
          breadcrumb={
            <Breadcrumb items={[{ label: "توسعه" }, { label: "سامانه طراحی" }]} />
          }
        />

        <Section title="دکمه" purpose="کنش اصلی و فرعی. از لینک برای ناوبری متنی استفاده کنید، نه برای ارسال فرم.">
          <Inline>
            <Button>اصلی</Button>
            <Button variant="secondary">ثانویه</Button>
            <Button variant="outline">خطی</Button>
            <Button variant="ghost">آرام</Button>
            <Button variant="destructive">مخرب</Button>
            <Button loading>در حال ارسال</Button>
            <IconButton label="اعلان‌ها">
              <Bell size={18} />
            </IconButton>
          </Inline>
        </Section>

        <Section title="فرم" purpose="خطا باید کنار فیلد باشد، نه فقط در Toast.">
          <Grid columns={2} gap={4}>
            <FormField id="name" label="نام" required description="نام نمایشی حساب">
              <Input id="name" name="name" />
            </FormField>
            <FormField id="email" label="ایمیل" error="قالب ایمیل معتبر نیست">
              <Input id="email" invalid aria-describedby="email-error" />
            </FormField>
            <FormField id="pass" label="رمز عبور">
              <PasswordInput
                id="pass"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            <FormField id="phone" label="تلفن">
              <PhoneInput id="phone" value={phone} onValueChange={setPhone} />
            </FormField>
            <FormField id="about" label="توضیح" optional>
              <Textarea id="about" maxLength={120} value="نمونه متن فارسی برای فیلد چندخطی." readOnly />
            </FormField>
            <FormField id="search" label="جستجو">
              <SearchInput
                id="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch("")}
                aria-label="جستجو"
              />
            </FormField>
          </Grid>
          <Checkbox
            label="پذیرش شرایط"
            description="فقط برای نمایش حالت نامعین در ماتریس مجوز بعدی."
            checked={checked}
            indeterminate
            onChange={(event) => setChecked(event.target.checked)}
          />
          <RadioGroup legend="نوع نوبت" orientation="horizontal">
            <Radio name="kind" label="حضوری" value="one" checked={radio === "one"} onChange={() => setRadio("one")} />
            <Radio name="kind" label="غیرحضوری" value="two" checked={radio === "two"} onChange={() => setRadio("two")} />
          </RadioGroup>
          <Switch label="اعلان فوری" checked={switchOn} onCheckedChange={setSwitchOn} />
          <Select
            options={serviceOptions}
            value={selectValue}
            onChange={setSelectValue}
            allowClear
          />
          <MultiSelect options={serviceOptions} values={multi} onChange={setMulti} />
        </Section>

        <Section title="تاریخ و ساعت" purpose="تقویم عمومی است و ظرفیت یا اسلات رزرو ندارد. جلالی در فاز ۴۸.">
          <DatePicker value={date} onChange={setDate} />
          <TimePicker value={time} onChange={setTime} />
          <Calendar value={date} onChange={(next) => setDate(next)} />
        </Section>

        <Section title="همپوشانی" purpose="مودال، کشو و تأیید از یک زیرساخت فوکوس استفاده می‌کنند.">
          <Inline>
            <Button onClick={() => setModalOpen(true)}>مودال</Button>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>کشو</Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>تأیید</Button>
            <Button variant="outline" onClick={() => toast.success("عملیات نمونه")}>Toast</Button>
            <Dropdown trigger={<Button variant="secondary">منو</Button>}>
              <DropdownItem>ویرایش</DropdownItem>
              <DropdownSeparator />
              <DropdownItem destructive>حذف</DropdownItem>
            </Dropdown>
          </Inline>
        </Section>

        <Section title="ناوبری" purpose="Stepper داده ویزارد رزرو را نگه نمی‌دارد.">
          <Tabs defaultValue="one">
            <TabList>
              <Tab value="one">مشخصات</Tab>
              <Tab value="two">زمان</Tab>
              <Tab value="three" disabled>پرداخت</Tab>
            </TabList>
            <TabPanel value="one">محتوای زبانه اول</TabPanel>
            <TabPanel value="two">محتوای زبانه دوم</TabPanel>
          </Tabs>
          <Accordion
            items={[
              { id: "1", title: "چگونه نوبت بگیرم؟", content: "این فقط متن راهنما است." },
              { id: "2", title: "آیا حضور لازم است؟", content: "بسته به نوع خدمت." },
            ]}
          />
          <Pagination page={page} pageCount={12} onPageChange={setPage} />
          <Stepper
            steps={[
              { id: "s1", label: "خدمت", state: "complete" },
              { id: "s2", label: "زمان", state: "current" },
              { id: "s3", label: "تأیید", state: "upcoming" },
            ]}
          />
        </Section>

        <Section title="نمایش داده" purpose="StatusBadge از نگاشت متمرکز استفاده می‌کند، نه رشته خام Backend.">
          <Inline>
            <Badge tone="primary">جدید</Badge>
            <StatusBadge status="confirmed" />
            <StatusBadge status="pendingPayment" />
            <Avatar name="سارا محمدی" />
          </Inline>
          <Grid columns={2}>
            <StatCard label="نوبت امروز" value="—" comparison="بدون داده تولیدی" />
            <Card title="کارت" description="سطح ملایم، بدون سایه اغراق‌شده.">
              محتوا
            </Card>
          </Grid>
          <Timeline
            items={[
              { id: "t1", title: "ثبت شد", state: "complete", meta: "09:00" },
              { id: "t2", title: "تأیید", state: "current" },
              { id: "t3", title: "انجام", state: "upcoming" },
            ]}
          />
          <Table caption="نمونه جدول عملیاتی">
            <TableHeader>
              <TableRow>
                <TableHead sorted="asc">نام</TableHead>
                <TableHead>وضعیت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>نمونه الف</TableCell>
                <TableCell>
                  <StatusBadge status="confirmed" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>

        <Section title="بازخورد و بارگذاری" purpose="Empty و No Results باید متفاوت بمانند. Feature/Backend/Conflict جدا هستند.">
          <Alert tone="warning" title="توجه" description="Toast جایگزین خطای فیلد، نشست منقضی، یا تأیید مخرب نیست." />
          <Grid columns={2}>
            <EmptyState />
            <NoResultsState />
            <ApiErrorState requestId="req_demo" />
            <SuccessState title="ثبت شد" description="این پیام نمایشی است." />
            <PermissionDeniedState />
            <SessionExpiredState />
            <FeatureDisabledState />
            <BackendDependencyState />
            <ConflictState />
          </Grid>
          <Inline>
            <Skeleton variant="circle" />
            <Skeleton variant="line" />
            <Skeleton variant="table-row" />
          </Inline>
        </Section>

        <Section title="بارگذاری پرونده" purpose="بدون ذخیره یا API. Object URL پس از حذف آزاد می‌شود.">
          <FileUpload files={files} onChange={setFiles} accept="image/png,image/jpeg" />
        </Section>

        <Section title="LTR" purpose="مقادیر لاتین باید در کانتینر LTR خوانا بمانند.">
          <div dir="ltr" className="ds-card">
            <p>Reference: <span className="text-numeric">APT-2048</span></p>
            <p>Time: <span className="text-numeric">14:30</span></p>
          </div>
        </Section>
      </Stack>

      <Modal open={modalOpen} title="نمونه مودال" description="فوکوس داخل پنجره می‌ماند." onClose={() => setModalOpen(false)}>
        <p>محتوای پیمایش‌پذیر برای فرم‌های بعدی.</p>
      </Modal>
      <Drawer open={drawerOpen} title="کشو" onClose={() => setDrawerOpen(false)}>
        <p>ناوبری واکنش‌گرا از همین الگو استفاده می‌کند.</p>
      </Drawer>
      <ConfirmDialog
        open={confirmOpen}
        title="حذف شود؟"
        description="این عمل نیاز به تأیید صریح دارد."
        consequence="پس از تأیید، بازگردانی ممکن نیست مگر Backend اجازه دهد."
        confirmLabel="حذف"
        variant="destructive"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      />
      <Divider />
    </Container>
  );
}
