import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

import { ModeToggle } from "@/components/mode-toggle";

import { Outlet, Link } from "react-router-dom";


/**
 * Renders the header of the application.
 * @category Component
 */
const Header = () => {
    return (
        <header>
            <nav className='w-full flex justify-between p-5'>
                <div>
                    <NavigationMenu>
                        <NavigationMenuList>
                            <NavigationMenuItem>
                                <NavigationMenuLink className={navigationMenuTriggerStyle()} asChild>
                                    <Link to="/">
                                        Home
                                    </Link>
                                </NavigationMenuLink>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <NavigationMenuLink className={navigationMenuTriggerStyle()} asChild>
                                    <Link to="/settings/general">
                                        Settings
                                    </Link>
                                </NavigationMenuLink>
                            </NavigationMenuItem>
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>
                <ModeToggle />
            </nav>
            <Outlet />
        </header>
    );
}

export default Header;