"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean }
>(function PasswordInput({ invalid, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      autoComplete={props.autoComplete ?? "current-password"}
      invalid={invalid}
      suffix={
        <IconButton
          type="button"
          size="sm"
          label={visible ? "پنهان کردن رمز" : "نمایش رمز"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </IconButton>
      }
      {...props}
    />
  );
});
