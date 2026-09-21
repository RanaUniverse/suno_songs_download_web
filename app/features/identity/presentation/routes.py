"""
app/features/identity/routes.py

Here i will keep login related things

/register ->
/verify_otp ->
/login ->

"""

from typing import cast


from flask import (
    Blueprint,
    flash,
    render_template,
    redirect,
    url_for,
)


from flask_login import (  # type: ignore
    login_required,  # type: ignore
    login_user,  # type: ignore
    logout_user,
    current_user,
)
from ..domain.enums import LoginStatus
from ..domain.exceptions import InvalidEmailError
from .forms import LoginForm, RegisterForm, OTPForm, LoginWithOtpForm, SetPasswordForm
from ..dependencies import RegistrationServiceDep, LoginServiceDep
from .message import FlashCategory

from ..presentation.authentication import FlaskLoginUser

from .registration_response import handle_registration_result


from app.shared.otp.domain.policy import get_otp_policy_obj
from app.shared.otp.domain.enums import OTPPurpose


from app.shared.session.enums import IdentitySessionKey
from app.shared.session.service import (
    set_identity_key as set_identity_key_in_session,
    pop_key as pop_key_from_session,
    get_identity_email as get_identity_email_from_session,
)

from .login_response import get_required_email

# TODO  i will later change this to call the service which will call the otp


auth_bp = Blueprint(
    name="auth_bp",
    import_name=__name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/identity_static",
)


@auth_bp.route(
    rule="/register",
    methods=["GET", "POST"],
)
def register(
    register_service: RegistrationServiceDep,
):
    """
    this page is for showing registerariotn page to user
    and if registion data submitted then this will shows
    the user the way of verify otp like this
    """
    form = RegisterForm()

    if form.validate_on_submit():  # type: ignore

        email = form.email.data or ""
        phone_number = form.phone.data or ""
        try:
            result = register_service.start(
                email=email,
                phone=phone_number,
            )

        except InvalidEmailError as e:
            flash(
                message=str(e),
                category="danger",
            )
            return render_template(
                "auth/register_page.html",
                form=form,
            )

        # This below will decide what to shows to user now
        return handle_registration_result(
            result=result,
        )

    for field, errors in form.errors.items():
        for error in errors:
            flash(
                message=f"{field.upper()}: {error}",
                category=FlashCategory.WARNING,
            )

    pending_email = get_identity_email_from_session(
        IdentitySessionKey.REGISTER_PENDING,
    )

    # Resume OTP verification for a pending registration

    if pending_email is not None:
        # later i will add redis checking if possible #TODO
        flash(
            f"📧 Registration pending for {pending_email}. "
            "🔐 Verify the OTP to continue, or 🔄 use a different email.",
            FlashCategory.WARNING,
        )

        return redirect(
            url_for(
                "auth_bp.verify_registration_otp",
            )
        )

    return render_template(
        template_name_or_list="auth/register_page.html",
        form=form,
    )


@auth_bp.route(
    "/verify-register-otp",
    methods=["GET", "POST"],
)
def verify_registration_otp(
    register_service: RegistrationServiceDep,
):
    """
    After the /register send otp then this page comes
    As this function should to run after the registration has done
    so i need to check if user comes externally or not also
    """

    email = get_identity_email_from_session(
        key=IdentitySessionKey.REGISTER_PENDING,
    )

    if email is None:
        flash(
            message="First Register Your Account with Email "
            "ID then verify your account",
            category=FlashCategory.WARNING,
        )
        return redirect(
            url_for(
                "auth_bp.register",
            )
        )

    policy = get_otp_policy_obj(
        purpose=OTPPurpose.REGISTER,
    )

    form = OTPForm(
        otp_length=policy.length,
    )

    if form.validate_on_submit():  # type: ignore

        otp = form.otp.data or ""

        try:
            result = register_service.email_otp_verify(
                email=email,
                submitted_otp=otp,
            )

        except InvalidEmailError as e:
            flash(
                message=str(e),
                category=FlashCategory.DANGER,
            )

            return render_template(
                "auth/verify_register_otp.html",
                form=form,
            )

        if result.success and result.user is not None:

            flash(
                "✅ OTP verified successfully! 🎉 You are now logged in.",
                FlashCategory.SUCCESS,
            )

            pop_key_from_session(
                key=IdentitySessionKey.REGISTER_PENDING,
            )
            pop_key_from_session(
                key=IdentitySessionKey.LOGIN_PENDING,
            )

            # i need to make sure this is using the flask-login class
            login_user(
                user=FlaskLoginUser(
                    result.user,
                ),
            )
            return redirect(
                url_for(
                    "general_bp.home",
                )
            )

        flash(
            "Invalid OTP",
            "danger",
        )

    return render_template(
        "auth/verify_register_otp.html",
        form=form,
        email=email,
    )


@auth_bp.route(
    rule="/change-registration-email",
    methods=[
        "POST",
    ],
)
def change_registration_email():
    """
    When the verify_registe_otp page is showsing there is a link
    to refere this page by which this will run
    When this request will come i need to check if the user
    """

    pop_key_from_session(
        key=IdentitySessionKey.REGISTER_PENDING,
    )

    flash(
        message="📧 No problem! Please enter your new email address "
        "to continue your registration.",
        category=FlashCategory.INFO,
    )

    return redirect(url_for("auth_bp.register"))


@auth_bp.route(
    rule="/resend-registration-otp",
    methods=[
        "POST",
    ],
)
def resend_registration_otp(
    register_service: RegistrationServiceDep,
):
    """
    Here i need to decide if the otp sending will done now or not
    then only i will send the otp.
    """
    # TODO: implement OTP resend logic where i am sending same
    # or differnet otp based on implimentations
    email = get_identity_email_from_session(
        key=IdentitySessionKey.REGISTER_PENDING,
    )

    if email is None:
        flash(
            message="First Register Your Account with Email "
            "ID then verify your account",
            category=FlashCategory.WARNING,
        )
        return redirect(
            url_for(
                "auth_bp.register",
            )
        )

    flash(
        message="📨 A new OTP will be sent in Your Email ID.",
        category=FlashCategory.INFO,
    )
    result = register_service.resend_otp(
        email=email,
    )
    return handle_registration_result(
        result=result,
    )


@auth_bp.route(
    "/login",
    methods=[
        "GET",
        "POST",
    ],
)
def login(
    login_service: LoginServiceDep,
):
    # it will first if login_pending session is ther or not then do shows
    # thigns here based on login with otp or with password

    form = LoginForm()

    if form.validate_on_submit():  # type: ignore
        email = form.email.data or ""
        password = form.password.data or ""

        user_obj = login_service.check_authentication(
            email=email,
            password=password,
        )

        if user_obj:
            login_user(
                user=FlaskLoginUser(
                    user_obj,
                )
            )
            flash(
                message="Login Successful",
                category="success",
            )
            return redirect(url_for("general_bp.home"))
        else:
            flash(
                message="Wrong Credentials",
                category=FlashCategory.WARNING,
            )
            flash(
                message="Please Login With OTP if you Don't Remember the password",
                category=FlashCategory.PRIMARY,
            )
            return (
                render_template(
                    template_name_or_list="auth/login.html",
                    form=form,
                ),
                401,
            )

    return render_template(
        template_name_or_list="auth/login.html",
        form=form,
    )


# @auth_bp.route(
#     rule="/login-with-password",
#     methods=["GET", "POST"],
# )
# def login_with_password(
#     login_service: LoginServiceDep,
# ):
#     """
#     This will take the email id and ask for the password to enter

#     Currently this is for coming from register

#     I will make this workable with login routes goodly and logically
#     """

#     email = get_identity_email_from_session(
#         IdentitySessionKey.LOGIN_PENDING,
#     )

#     if email is None:
#         flash(
#             "Please Enter your email and password to login",
#             "warning",
#         )
#         return redirect(
#             url_for(
#                 "auth_bp.login",
#             )
#         )

#     form = LoginForm()

#     if form.validate_on_submit():  # type: ignore
#         password = form.password.data or ""
#         user_obj = login_service.check_authentication(
#             email=email,
#             password=password,
#         )

#         if user_obj:
#             login_user(
#                 user=user_obj,
#             )
#             pop_key_from_session(
#                 key=IdentitySessionKey.REGISTER_PENDING,
#             )
#             pop_key_from_session(
#                 key=IdentitySessionKey.LOGIN_PENDING,
#             )
#             flash(
#                 "Login Successfull",
#                 "success",
#             )

#             return redirect(
#                 url_for(
#                     "general_bp.home",
#                 )
#             )

#         flash(
#             "wrong Password",
#             "warning",
#         )

#     return render_template(
#         "auth/login_with_password.html",
#         form=form,
#         email=email,
#     )


@auth_bp.route(
    rule="/login-with-otp",
    methods=["GET", "POST"],
)
def login_with_otp(
    login_service: LoginServiceDep,
):
    """
    Start the email OTP login flow.

    GET:
        Show the email form.

    POST:
        Ask the login service to send a login OTP.
        On success, store the pending email in the session
        and redirect to OTP verification.
    """

    form = LoginWithOtpForm()

    if form.validate_on_submit():  # type: ignore

        email = form.email.data or ""

        try:
            result = login_service.send_otp_for_login(
                email=email,
            )

        except InvalidEmailError as e:
            flash(
                message=str(e),
                category=FlashCategory.DANGER,
            )

            return render_template(
                "auth/login_with_otp.html",
                form=form,
            )

        if result.status == LoginStatus.OTP_SENT:

            validated_email = get_required_email(
                result=result,
            )

            if validated_email is None:
                flash(
                    "Something went wrong. Please try again with another details.",
                    "danger",
                )
                return redirect(url_for("auth_bp.login"))

            set_identity_key_in_session(
                key=IdentitySessionKey.LOGIN_PENDING,
                email_value=validated_email,
            )

            f_name = result.full_name or "User"

            flash(
                message=f"Hello {f_name} 📧 Login code sent! Check your email to continue.",
                category=FlashCategory.SUCCESS,
            )

            return redirect(
                url_for(
                    "auth_bp.verify_login_otp",
                )
            )

        elif result.status == LoginStatus.NO_ACCOUNT:
            flash(
                message=(
                    "No account was found with this email. " "Please register first."
                ),
                category=FlashCategory.WARNING,
            )
            return redirect(url_for("auth_bp.register"))

        elif result.status == LoginStatus.PROBLEM:
            flash(
                message=(
                    "We couldn't start OTP login right now. "
                    "Please try again in a moment."
                ),
                category=FlashCategory.WARNING,
            )

    for field, errors in form.errors.items():
        for error in errors:
            flash(
                message=f"{field.upper()}: {error}",
                category=FlashCategory.WARNING,
            )

    return render_template(
        "auth/login_with_otp.html",
        form=form,
    )


@auth_bp.route(
    rule="/verify-login-otp",
    methods=["GET", "POST"],
)
def verify_login_otp(
    login_service: LoginServiceDep,
):
    """
    Verify the OTP that was sent during the login-with-OTP flow. The email is taken from the pending-login session rather than from the request itself.
    """

    email = get_identity_email_from_session(
        IdentitySessionKey.LOGIN_PENDING,
    )

    if email is None:
        flash(
            message=(
                "No login attempt is currently pending. "
                "Please enter your email first."
            ),
            category=FlashCategory.WARNING,
        )

        return redirect(url_for("auth_bp.login_with_otp"))

    policy = get_otp_policy_obj(
        purpose=OTPPurpose.LOGIN,
    )

    form = OTPForm(
        otp_length=policy.length,
    )

    if form.validate_on_submit():  # type: ignore

        submitted_otp = form.otp.data or ""
        try:
            result = login_service.complete_login_with_otp(
                email=email,
                submitted_otp=submitted_otp,
            )
        except InvalidEmailError as e:
            flash(
                message=str(e) + f" Please Use Valid Email id on Registration",
                category=FlashCategory.DANGER,
            )
            return render_template("auth/verify_login_otp.html")

        if result.success and result.user is not None:
            login_user(
                user=FlaskLoginUser(
                    result.user,
                )
            )
            pop_key_from_session(
                key=IdentitySessionKey.REGISTER_PENDING,
            )
            pop_key_from_session(
                key=IdentitySessionKey.LOGIN_PENDING,
            )
            # TODO maybe i will also remove the registerion pending session
            flash(
                message="✅ OTP verified successfully! 🎉 You are now logged in.",
                category=FlashCategory.SUCCESS,
            )
            return redirect(url_for("general_bp.home"))

        # This line means not success
        flash(
            message="Invalid or Expired OTP, Please Try Again",
            category=FlashCategory.DANGER,
        )
        return render_template(
            "auth/verify_login_otp.html",
            form=form,
            email=email,
        )

        # result = login_service.
        # this will verify the otp and then allow to login the user

    return render_template(
        template_name_or_list="auth/verify_login_otp.html",
        form=form,
        email=email,
    )


@auth_bp.route(rule="/resend-login-otp", methods=["POST"])
def resend_login_otp():
    """
    Here i need to decide if the otp sending will done now or not
    then only i will send the otp.
    """
    # TODO: implement OTP resend logic where i am sending same
    # or differnet otp based on implimentations

    flash(
        message="📨 A new OTP will be sent here for login.",
        category=FlashCategory.INFO,
    )

    return redirect(
        url_for(
            "auth_bp.verify_login_otp",
        )
    )


# later i will want ot make this fresh login here
@auth_bp.route(
    rule="/set-password",
    methods=[
        "GET",
        "POST",
    ],
)
@login_required
def set_password(
    register_service: RegistrationServiceDep,
    # i will later think about this service or change one
):
    """
    Here i will use to set a password after he will register successfully
    this page will later i will add after otp verify on /register
    for now i will keep this in the profile page
    """
    if not current_user.is_authenticated:
        flash(
            "This shoudl not happens without login, contact admin",
            FlashCategory.WARNING,
        )
        return redirect(url_for("auth_bp.login"))

    user = cast(FlaskLoginUser, current_user)

    full_name = user.domain_user.full_name or "You"

    form = SetPasswordForm()

    if form.validate_on_submit():  # type: ignore
        password = form.password.data
        if not password:
            flash("Password Need to given must")
            return redirect(url_for("auth_bp.register"))
        updated_user = register_service.set_password(
            user.get_id(),
            password=password,
        )
        msg = f"Your New Password: {password}, new obje: {updated_user}"
        return msg

    flash(
        f"Hello {full_name}, Please Enter Password if you want "
        "to login with password next time",
        FlashCategory.SECONDARY,
    )
    return render_template(
        "auth/set_password.html",
        form=form,
    )


@auth_bp.route(rule="/logout")
@login_required
def logout():
    logout_user()
    flash(
        message="👋 You've been successfully logged out. See you again soon! 🚀",
        category="success",  # Using 'success' or 'info' feels friendlier than a harsh 'danger' flash for logging out
    )
    return redirect(location=url_for("general_bp.home"))
