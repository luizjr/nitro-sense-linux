// SPDX-License-Identifier: GPL-2.0
/*
 * nitro_kbd — minimal Acer Nitro 4-zone gaming keyboard RGB driver.
 *
 * Talks ONLY to the Acer gaming WMI interface (GUID 7A4DDFE7) which the
 * in-tree acer_wmi driver does not claim. It therefore coexists with acer_wmi,
 * keeping fan PWM control + platform_profile intact while adding RGB.
 *
 * Protocol (replicated from the community facer module / PredatorSense):
 *   /dev/nitro-kbd-static  (4 bytes)  -> method 6  : [zoneMask, R, G, B]
 *   /dev/nitro-kbd         (16 bytes) -> method 20 : [mode, speed, brightness,
 *                                                     extra, direction, R,G,B,
 *                                                     0, commit(=1), 0...]
 * Both writes go through wmi_evaluate_method on the gaming GUID.
 */
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>
#include <linux/fs.h>
#include <linux/cdev.h>
#include <linux/device.h>
#include <linux/slab.h>
#include <linux/uaccess.h>
#include <linux/acpi.h>
#include <linux/wmi.h>

#define GAMING_GUID "7A4DDFE7-5B5D-40B4-8595-4408E0CC7F56"
#define METHOD_DYNAMIC 20
#define METHOD_STATIC 6
#define DYN_LEN 16
#define STATIC_LEN 4

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Nitro Sense Linux");
MODULE_DESCRIPTION("Acer Nitro 4-zone gaming keyboard RGB (coexists with acer_wmi)");
MODULE_VERSION("0.1");

struct led_zone_set_param {
	u8 zone;
	u8 red;
	u8 green;
	u8 blue;
} __packed;

static dev_t dyn_devt, stat_devt;
static struct class *kbd_class;
static struct cdev dyn_cdev, stat_cdev;

static int kbd_uevent(const struct device *dev, struct kobj_uevent_env *env)
{
	/* expose the nodes world-writable so the desktop app can drive them */
	add_uevent_var(env, "DEVMODE=%#o", 0666);
	return 0;
}

static ssize_t dyn_write(struct file *f, const char __user *buf, size_t n,
			 loff_t *off)
{
	u8 cfg[DYN_LEN];
	struct acpi_buffer input = { DYN_LEN, cfg };
	struct acpi_buffer result = { ACPI_ALLOCATE_BUFFER, NULL };
	acpi_status status;

	if (n != DYN_LEN) {
		pr_err("nitro_kbd: dynamic write needs exactly %d bytes\n", DYN_LEN);
		return -EINVAL;
	}
	if (copy_from_user(cfg, buf, DYN_LEN))
		return -EFAULT;

	status = wmi_evaluate_method(GAMING_GUID, 0, METHOD_DYNAMIC, &input, &result);
	if (ACPI_FAILURE(status)) {
		pr_err("nitro_kbd: WMI dynamic call failed (0x%x)\n", status);
		return -EIO;
	}
	kfree(result.pointer);
	return n;
}

static ssize_t stat_write(struct file *f, const char __user *buf, size_t n,
			  loff_t *off)
{
	u8 cfg[STATIC_LEN] = { 0 };
	struct led_zone_set_param p;
	struct acpi_buffer input = { sizeof(p), &p };
	acpi_status status;

	if (n != STATIC_LEN) {
		pr_err("nitro_kbd: static write needs exactly %d bytes\n", STATIC_LEN);
		return -EINVAL;
	}
	if (copy_from_user(cfg, buf, STATIC_LEN))
		return -EFAULT;

	p.zone = cfg[0];
	p.red = cfg[1];
	p.green = cfg[2];
	p.blue = cfg[3];

	status = wmi_evaluate_method(GAMING_GUID, 0, METHOD_STATIC, &input, NULL);
	if (ACPI_FAILURE(status)) {
		pr_err("nitro_kbd: WMI static call failed (0x%x)\n", status);
		return -EIO;
	}
	return n;
}

static const struct file_operations dyn_fops = {
	.owner = THIS_MODULE,
	.write = dyn_write,
};
static const struct file_operations stat_fops = {
	.owner = THIS_MODULE,
	.write = stat_write,
};

static int __init nitro_kbd_init(void)
{
	int err;

	if (!wmi_has_guid(GAMING_GUID)) {
		pr_err("nitro_kbd: Acer gaming WMI GUID not present\n");
		return -ENODEV;
	}

	kbd_class = class_create("nitro-kbd");
	if (IS_ERR(kbd_class))
		return PTR_ERR(kbd_class);
	kbd_class->dev_uevent = kbd_uevent;

	err = alloc_chrdev_region(&dyn_devt, 0, 1, "nitro-kbd");
	if (err)
		goto err_class;
	cdev_init(&dyn_cdev, &dyn_fops);
	dyn_cdev.owner = THIS_MODULE;
	err = cdev_add(&dyn_cdev, dyn_devt, 1);
	if (err)
		goto err_dyn_region;
	device_create(kbd_class, NULL, dyn_devt, NULL, "nitro-kbd");

	err = alloc_chrdev_region(&stat_devt, 0, 1, "nitro-kbd-static");
	if (err)
		goto err_dyn_dev;
	cdev_init(&stat_cdev, &stat_fops);
	stat_cdev.owner = THIS_MODULE;
	err = cdev_add(&stat_cdev, stat_devt, 1);
	if (err)
		goto err_stat_region;
	device_create(kbd_class, NULL, stat_devt, NULL, "nitro-kbd-static");

	pr_info("nitro_kbd: loaded (Acer 4-zone RGB via WMI %s)\n", GAMING_GUID);
	return 0;

err_stat_region:
	unregister_chrdev_region(stat_devt, 1);
err_dyn_dev:
	device_destroy(kbd_class, dyn_devt);
	cdev_del(&dyn_cdev);
err_dyn_region:
	unregister_chrdev_region(dyn_devt, 1);
err_class:
	class_destroy(kbd_class);
	return err;
}

static void __exit nitro_kbd_exit(void)
{
	device_destroy(kbd_class, stat_devt);
	cdev_del(&stat_cdev);
	unregister_chrdev_region(stat_devt, 1);

	device_destroy(kbd_class, dyn_devt);
	cdev_del(&dyn_cdev);
	unregister_chrdev_region(dyn_devt, 1);

	class_destroy(kbd_class);
	pr_info("nitro_kbd: unloaded\n");
}

module_init(nitro_kbd_init);
module_exit(nitro_kbd_exit);
